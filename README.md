# Audio2Resumen

Audio2Resumen es una aplicación que utiliza la librería [Baileys](https://github.com/adiwajshing/Baileys) para conectarse a WhatsApp Web mediante websockets. Permite la transcripción de mensajes de voz.

## Instalación

Para instalar la aplicación, se deben seguir los siguientes pasos:

1. Clonar este repositorio.
2. Instalar las dependencias con el comando `npm install`.
3. Ejecutar la aplicación con el comando `npm start`.

Es importante tener en cuenta que se debe tener Python 3 instalado en el sistema y configurado en la variable de entorno PATH.

## Uso

La aplicación se conectará a WhatsApp Web y estará escuchando los eventos que reciba. Al recibir un mensaje de voz, la aplicación lo descifrará, lo transcribirá mediante un script en Python y enviará la transcripción al chat correspondiente.

### Comandos

La aplicación se puede ejecutar con los siguientes comandos:

- `npm start`: Ejecuta la aplicación.
- `npm run clean`: Borra los archivos temporales generados por la aplicación.

### Variables de entorno

La aplicación utiliza las siguientes variables de entorno:

- `--no-store`: Evita que se use la memoria caché para guardar datos de la sesión de WhatsApp.
- `--no-reply`: Evita que se envíen respuestas automáticas a los mensajes recibidos.
