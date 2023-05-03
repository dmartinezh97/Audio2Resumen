import whisper
import sys
import base64

audio = sys.argv[1]
model = whisper.load_model("medium") #medium
result = model.transcribe(audio, fp16=False)
texto_en_base64 = base64.b64encode(bytes(result["text"], 'utf-8')).decode("utf-8")
print(texto_en_base64)