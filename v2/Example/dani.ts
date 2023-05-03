import { Boom } from '@hapi/boom'
import NodeCache from 'node-cache'
import makeWASocket, { AnyMessageContent, delay, DisconnectReason, downloadMediaMessage, fetchLatestBaileysVersion, isJidBroadcast, makeCacheableSignalKeyStore, makeInMemoryStore, useMultiFileAuthState } from '../src'
import MAIN_LOGGER from '../src/Utils/logger'
import fs from 'fs'
import { exec, spawn } from 'child_process'

const logger = MAIN_LOGGER.child({})
logger.level = 'error'

const useStore = !process.argv.includes('--no-store')
const doReplies = !process.argv.includes('--no-reply')

// external map to store retry counts of messages when decryption/encryption fails
// keep this out of the socket itself, so as to prevent a message decryption/encryption loop across socket restarts
const msgRetryCounterCache = new NodeCache()

// the store maintains the data of the WA connection in memory
// can be written out to a file & read from it
const store = useStore ? makeInMemoryStore({ logger }) : undefined
store?.readFromFile('./baileys_store_multi.json')
// save every 10s
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
            /** caching makes the store faster to send/recv messages */
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
            if(events['connection.update']){
                //console.log("-- connection.update: ", events['connection.update'])
            }
            if(events['creds.update']){
                await saveCreds()
                // console.log("-- creds.update: ", events['creds.update'])
            }
            if(events['messaging-history.set']){
                // console.log("-- messaging-history.set: ", events['messaging-history.set'])
            }
            if(events['chats.upsert']){
                // console.log("-- chats.upsert: ", events['chats.upsert'])
            }
            if(events['chats.update']){
                //console.log("-- chats.update: ", events['chats.update'])
            }
            if(events['chats.delete']){
                // console.log("-- chats.delete: ", events['chats.delete'])
            }
            if(events['presence.update']){
                // let datos = events['presence.update']
                // if(datos && datos.id && datos.presences){
                //     let date = new Date()
                //     let horaActual = date.getHours() + ':' + date.getMinutes().toString().padStart(2, '0') + ':' + date.getSeconds().toString().padStart(2, '0')
                //     // console.log(`Enviar online a las: ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`)
                //     try {
                //         let estado = datos.presences[datos.id].lastKnownPresence.toString() == 'available' ? 'Se ha conectado' : 'Se ha desconectado'
                //         let nombre = database.find(x => x.id === datos.id)
                //         if(estado == 'Se ha conectado'){
                //             console.log('\x1b[31m%s\x1b[0m', `${nombre?.nombre} - ${estado} a las ${horaActual}`, datos.presences)
                //         }else{
                //             console.log('\x1b[34m%s\x1b[0m', `${nombre?.nombre} - ${estado} a las ${horaActual}`, datos.presences)
                //         }
                //     } catch (error) {
                //         console.log("error: ", datos.presences)                        
                //     }
                //     //console.log(`ID: ${datos.id} - `, datos.presences)
                // }
                //console.log("-- presence.update: ", events['presence.update'])
            }
            if(events['contacts.upsert']){
                // console.log("-- contacts.upsert: ", events['contacts.upsert'])
            }
            if(events['contacts.update']){
                // console.log("-- contacts.update: ", events['contacts.update'])
            }
            if(events['messages.delete']){
                // console.log("-- messages.delete: ", events['messages.delete'])
            }
            if(events['messages.update']){
                //console.log("-- messages.update: ", events['messages.update'])
            }
            if(events['messages.media-update']){
                // console.log("-- messages.media-update: ", events['messages.media-update'])
            }
            if(events['messages.upsert']) {
                const upsert = events['messages.upsert']
				console.log('recv messages ', JSON.stringify(upsert, undefined, 2))
                console.log(upsert.type)
                if(upsert.type === 'notify'){
                    for(const msg of upsert.messages) {
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
                            const tempFilePath = './audiotemp/' + msg.key.id + '.mp3';
                            fs.writeFileSync(tempFilePath, audioBuffer); //{ encoding: 'base64' }

                            exec(`python3 Example/transcribir.py ${tempFilePath}`, async (error, stdout, stderr) => {
                                if (error) {
                                  console.error(`Error ejecutando el comando: ${error}`);
                                  return;
                                }
                                await sendMessageWTyping({ text: stdout }, msg.key.remoteJid!)
                                // console.log(`stdout: ${stdout}`);
                                // console.error(`stderr: ${stderr}`);
                              });

                            // const proceso = spawn('python3', ['Example/transcribir.py', tempFilePath]);
                            // let bufferBase64 = '';

                            // proceso.stdout.on('data', (data) => {
                            //     bufferBase64 += data;
                            // });
                    
                            // proceso.stdout.on('end', async () => {
                            //     const messageDecode = Buffer.from(bufferBase64, 'base64').toString("utf-8")
                            //     await sendMessageWTyping({ text: messageDecode }, msg.key.remoteJid!)
                            // });
                    
                            // proceso.stderr.on('data', (data) => {
                            //     console.error(`Error: ${data}`);
                            // });
                            
                            // proceso.on('close', (code) => {
                            //     console.log(`El proceso de Python se cerró con el código ${code}`);
                            // });
                            
                            // proceso.on('error', (error) => {
                            //     console.error(`Error al ejecutar el proceso de Python: ${error}`);
                            // });

                            // if(msg.mediaData && msg.mediaData.localPath){
                            //     await sendMessageWTyping({ text: msg.mediaData.localPath.toString() }, msg.key.remoteJid!)
                            // }
                        }
					}
                }
                // console.log("-- messages.upsert: ", events['messages.upsert'].messages, events['messages.upsert'].type, events['messages.upsert'])
            }
            if(events['messages.reaction']){
                // console.log("-- messages.reaction: ", events['messages.reaction'])
            }
            if(events['message-receipt.update']){
                // console.log("-- message-receipt.update: ", events['message-receipt.update'])
            }
            if(events['groups.upsert']){
                // console.log("-- groups.upsert: ", events['groups.upsert'])
            }
            if(events['groups.update']){
                // console.log("-- groups.update: ", events['groups.update'])
            }
            if(events['group-participants.update']){
                // console.log("-- group-participants.update: ", events['group-participants.update'])
            }
            if(events['blocklist.set']){
                // console.log("-- blocklist.set: ", events['blocklist.set'])
            }
            if(events['blocklist.update']){
                // console.log("-- blocklist.update: ", events['blocklist.update'])
            }
            if(events['call']){
                // console.log("-- call: ", events['call'])
            }
        }
    )
}

startSock()