import { Boom } from '@hapi/boom'
import NodeCache from 'node-cache'
import makeWASocket, { AnyMessageContent, delay, DisconnectReason, downloadMediaMessage, fetchLatestBaileysVersion, isJidBroadcast, makeCacheableSignalKeyStore, makeInMemoryStore, useMultiFileAuthState } from './src'
import MAIN_LOGGER from './src/Utils/logger'
import fs from 'fs'
import { exec, spawn } from 'child_process'

const logger = MAIN_LOGGER.child({})
logger.level = 'error'

const useStore = !process.argv.includes('--no-store')
const doReplies = !process.argv.includes('--no-reply')

// Mapa externo para almacenar los reintentos de mensajes cuando falla el descifrado/cifrado
// Mantener esto fuera del propio socket, para evitar un bucle de desencriptación/encriptación de mensajes al reiniciar el socket
const msgRetryCounterCache = new NodeCache()

// El store mantiene los datos de la conexión WA en memoria
// Se pueden escribir en un fichero y leer de él
const store = useStore ? makeInMemoryStore({ logger }) : undefined
store?.readFromFile('./baileys_store_multi.json')
// Guardar cada 10s
setInterval(() => {
    store?.writeToFile('./baileys_store_multi.json')
}, 10_000)

const startSock = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log(`Usando WhatsappWeb v${version.join('.')} con websockets en ultima version: ${isLatest}`)

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: true,
        markOnlineOnConnect: true,
        auth: {
            creds: state.creds,
            /** El almacenamiento en caché hace que el store envíe/reciba mensajes más rápidamente */
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
    })

    store?.bind(sock.ev)

    const sendMessageWTyping = async(msg: AnyMessageContent, jid: string) => {
		await sock.presenceSubscribe(jid)
		await delay(500)

		await sock.sendPresenceUpdate('composing', jid)
		await delay(2000)

		await sock.sendPresenceUpdate('paused', jid)

		await sock.sendMessage(jid, msg)
	}

    sock.ev.process(
        async (events) => {
            if(events['creds.update']){
                await saveCreds()
            }
            if(events['messages.upsert']) {
                const upsert = events['messages.upsert']
                if(upsert.type === 'notify'){
                    for(const msg of upsert.messages) {
                        try {
                            if(msg.message && msg.message.audioMessage && msg.message.audioMessage.mimetype === 'audio/ogg; codecs=opus'){
                                await sendMessageWTyping({ text: 'Transcribiendo...' }, msg.key.remoteJid!)
                                const mediaData = await downloadMediaMessage(msg, "buffer", { })
                                let audioBuffer: Buffer;
                                
                                if(Buffer.isBuffer(mediaData)){
                                    audioBuffer = mediaData
                                }else{
                                    audioBuffer = await new Promise((resolve, reject) => {
                                        const chunks: Buffer[] = [];
                                        mediaData.on('data', (chunk: Buffer) => {
                                            chunks.push(chunk);
                                        });
                                        mediaData.on('end', () => {
                                            const buffer = Buffer.concat(chunks);
                                            resolve(buffer);
                                        });
                                        mediaData.on('error', (err: Error) => {
                                            reject(err);
                                        });
                                    });
                                }
                                const tempFilePath = './temp/' + msg.key.id + '.mp3';
                                fs.writeFileSync(tempFilePath, audioBuffer); //{ encoding: 'base64' }
    
                                exec(`python3 Example/transcribir.py ${tempFilePath}`, async (error, stdout, stderr) => {
                                    if (error) {
                                      console.error(`Error ejecutando el comando: ${error}`);
                                      return;
                                    }
                                    await sendMessageWTyping({ text: stdout }, msg.key.remoteJid!)
                                  });
                            }
                        } catch (error) {
                            /* De momento no se controla ni se registra ningún error */
                        }
					}
                }
            }
        }
    )
}

startSock()