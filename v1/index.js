const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { spawn } = require('child_process');
// const iconv = require('iconv-lite');

// iconv.encodingExists('utf8'); // Verifica si la codificación utf8 está disponible

// // Establece la codificación de caracteres para la entrada y salida de tu proyecto
// process.stdin.setEncoding('utf8');
// process.stdout.setEncoding('utf8');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "client-one",
        dataPath: './.wwebjs_auth'
    })
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('authenticated', () => {
    console.log('Client is authenticated!');
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message_create', async (message) => {
    // if (message.type) {
    //     const mediaData  = await message.downloadMedia()
    //     const tempFilePath = './audiotemp/' + message.id.id + '.ogg';
    //     fs.writeFileSync(tempFilePath, mediaData.data, { encoding: 'base64' });

    //     const proceso = spawn('python', ['transcribir.py', tempFilePath]);
    //     let bufferBase64 = '';

    //     proceso.stdout.on('data', (data) => {
    //         bufferBase64 += data;
    //     });

    //     proceso.stdout.on('end', async () => {
    //         const messageDecode = Buffer.from(bufferBase64, 'base64').toString("utf-8")
    //         // chat.sendMessage(iconv.encode(buffer, "utf-8"))
    //         // chat.sendMessage(iconv.encode(buffer, "iso-8859-1"))
    //     });

    //     proceso.stderr.on('data', (data) => {
    //         console.error(`Error: ${data}`);
    //     });
        
    //     proceso.on('close', (code) => {
    //         console.log(`El proceso de Python se cerró con el código ${code}`);
    //     });
        
    //     proceso.on('error', (error) => {
    //         console.error(`Error al ejecutar el proceso de Python: ${error}`);
    //     });
    // }
});

client.on('message', async (message) => {
    const chat = await message.getChat();

    if(message.type === "audio" || message.type === "ptt"){
        chat.sendMessage("Transcribiendo...")
        const mediaData  = await message.downloadMedia()
        const tempFilePath = './audiotemp/' + message.id.id + '.ogg';
        fs.writeFileSync(tempFilePath, mediaData.data, { encoding: 'base64' });

        const proceso = spawn('python', ['transcribir.py', tempFilePath]);
        let bufferBase64 = '';

        proceso.stdout.on('data', (data) => {
            bufferBase64 += data;
        });

        proceso.stdout.on('end', async () => {
            const messageDecode = Buffer.from(bufferBase64, 'base64').toString("utf-8")
            chat.sendMessage(messageDecode)
        });

        proceso.stderr.on('data', (data) => {
            console.error(`Error: ${data}`);
        });
        
        proceso.on('close', (code) => {
            console.log(`El proceso de Python se cerró con el código ${code}`);
        });
        
        proceso.on('error', (error) => {
            console.error(`Error al ejecutar el proceso de Python: ${error}`);
        });
    }

    // if (message.type === 'audio') {
    //     // console.log('Mensaje recibido:', message);
    //     const mediaData  = await message.downloadMedia()
    //     const tempFilePath = './audiotemp/' + message.id.id + '.ogg';
    //     fs.writeFileSync(tempFilePath, mediaData.data, { encoding: 'base64' });

    //     console.log(tempFilePath)

    //     const proceso = spawn('python', ['transcribir.py', tempFilePath]);
    //     let buffer = '';


    //     proceso.stdout.on('data', (data) => {
    //         buffer += data.toString();
    //     });

    //     proceso.stdout.on('end', async () => {
    //         console.log(escape(buffer))
    //         // chat.sendMessage(iconv.encode(buffer, "utf-8"))
    //         // chat.sendMessage(iconv.encode(buffer, "iso-8859-1"))
            
    //         // message.reply(iconv.decode(buffer, "utf-8"))
    //         // Convertir el archivo de audio a formato MP3
    //         // const mp3FilePath = './audio-temp/' + message.id.id + '.mp3';
    //         // const ffmpegProceso = spawn('ffmpeg', ['-i', tempFilePath, '-codec:a', 'libmp3lame', mp3FilePath]);
    //         // await new Promise(resolve => ffmpegProceso.on('close', resolve));

    //         // // Enviar el archivo MP3 convertido como respuesta al mensaje de audio original
    //         // const mp3Data = fs.readFileSync(mp3FilePath);
    //         // const mp3Message = await message.reply(mp3Data, null, { sendMediaAsDocument: true });

    //         // // Borrar los archivos temporales
    //         // fs.unlinkSync(tempFilePath);
    //         // fs.unlinkSync(mp3FilePath);

    //         // console.log(`Mensaje de audio convertido enviado con ID ${mp3Message.id.id}`);
    //         // procesarDatos(buffer).then(resultado => {
    //         //     console.log(`El resultado es: ${resultado}`);
    //         // }).catch(error => {
    //         //     console.error(`Error al procesar los datos: ${error}`);
    //         // });
    //     });

    //     proceso.stderr.on('data', (data) => {
    //         console.error(`Error: ${data}`);
    //       });
          
    //       proceso.on('close', (code) => {
    //         console.log(`El proceso de Python se cerró con el código ${code}`);
    //       });
          
    //       proceso.on('error', (error) => {
    //         console.error(`Error al ejecutar el proceso de Python: ${error}`);
    //       });
    // }

    // if (message.type === 'ptt') {
    //     console.log('Mensaje recibido:', message);
    //     const parametro = message.body; // Utilizar el texto del mensaje como parámetro
    //     const proceso = spawn('python', ['transcribir.py', parametro]);
    //     let buffer = '';


    //     proceso.stdout.on('data', (data) => {
    //         buffer += data.toString();
    //     });

    //     proceso.stdout.on('end', () => {
    //         procesarDatos(buffer).then(resultado => {
    //             console.log(`El resultado es: ${resultado}`);
    //         }).catch(error => {
    //             console.error(`Error al procesar los datos: ${error}`);
    //         });
    //     });
    // }
    
    // const chat = await message.getChat();
    // const contact = await message.getContact();

    //console.log(chat, contact)

	// if(message.body === '!ping') {
	// 	message.reply('pong');
	// }
    // if(message.body === '!sticker') {
    //     // const attachmentData = await message.downloadMedia();
    //     //     chat.sendMessage(attachmentData, { sendMediaAsSticker: true });
	// 	// const sticker = MessageMedia.fromFilePath('/path/to/image.png');
    //     // chat.sendMessage(sticker, { sendMediaAsSticker: true });
	// }
    
});

function procesarDatos(buffer) {
    return new Promise((resolve, reject) => {
        // Aquí puedes procesar los datos en el buffer de manera asíncrona
        // Por ejemplo, podrías llamar a una función asíncrona que procese los datos
        // y devuelva un resultado.
        // En este ejemplo, simplemente devolvemos los datos del buffer como resultado.
        resolve(buffer);
    });
}

client.initialize();
