import whisper
import warnings
from numba.core.errors import NumbaDeprecationWarning


warnings.filterwarnings("ignore", category=NumbaDeprecationWarning)

model = whisper.load_model("base")
result = model.transcribe("audio.ogg")
print(result["text"])