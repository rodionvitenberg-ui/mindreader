from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import torch

model_id = "openai/clip-vit-base-patch32"

# Глобальные переменные для хранения модели, но пока они пустые
_model = None
_processor = None

def _load_model():
    """
    Ленивая загрузка. Модель поднимется в ОЗУ только тогда, 
    когда воркер реально начнет обрабатывать первое фото.
    """
    global _model, _processor
    if _model is None or _processor is None:
        print("Loading CLIP model to RAM... This happens only once per worker.")
        _model = CLIPModel.from_pretrained(model_id)
        _processor = CLIPProcessor.from_pretrained(model_id)
    return _model, _processor

def get_image_embedding(image_file):
    """
    Принимает файловый объект (работает и с диском, и с S3).
    """
    model, processor = _load_model()
    
    # PIL.Image отлично умеет читать напрямую из файловых объектов
    image = Image.open(image_file).convert("RGB")
    
    inputs = processor(images=image, return_tensors="pt")
    
    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
        
    image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
    return image_features.squeeze().tolist()