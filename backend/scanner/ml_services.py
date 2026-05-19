from PIL import Image
from transformers import CLIPProcessor, CLIPVisionModelWithProjection # Изменили импорт
import torch

model_id = "openai/clip-vit-base-patch32"

_model = None
_processor = None

def _load_model():
    global _model, _processor
    if _model is None or _processor is None:
        print("Loading CLIP model to RAM... This happens only once per worker.")
        # Используем конкретную модель с проекцией
        _model = CLIPVisionModelWithProjection.from_pretrained(model_id) 
        _processor = CLIPProcessor.from_pretrained(model_id)
    return _model, _processor

def get_image_embedding(image_file):
    model, processor = _load_model()
    image = Image.open(image_file).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    
    with torch.no_grad():
        outputs = model(**inputs)
        # Явно достаем тензор с эмбеддингами из объекта ответа
        image_features = outputs.image_embeds 
        
    image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
    return image_features.squeeze().tolist()