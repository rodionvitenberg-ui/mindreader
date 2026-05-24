from PIL import Image
from transformers import CLIPProcessor, CLIPVisionModelWithProjection
import torch
from ultralytics import YOLO

model_id = "openai/clip-vit-base-patch32"

_clip_model = None
_clip_processor = None
_yolo_model = None

def _load_models():
    global _clip_model, _clip_processor, _yolo_model
    
    if _clip_model is None or _clip_processor is None:
        print("Loading CLIP model to RAM...")
        _clip_model = CLIPVisionModelWithProjection.from_pretrained(model_id) 
        _clip_processor = CLIPProcessor.from_pretrained(model_id)
        
    if _yolo_model is None:
        print("Loading YOLOv8n model to RAM...")
        # Загружаем нано-модель YOLO (самая быстрая, весит около 6 МБ, скачается автоматически)
        _yolo_model = YOLO('yolov8n.pt') 
        
    return _clip_model, _clip_processor, _yolo_model

def get_image_embedding(image_file):
    clip_model, clip_processor, yolo_model = _load_models()
    image = Image.open(image_file).convert("RGB")
    
    # 1. Детекция и Кроп через YOLO
    # YOLO принимает PIL Image напрямую
    results = yolo_model(image, verbose=False)
    cropped_image = image
    
    # Проверяем, нашел ли YOLO хотя бы один объект
    if len(results) > 0 and len(results[0].boxes) > 0:
        # Берем самый уверенный bounding box (YOLO по умолчанию сортирует их по убыванию confidence)
        box = results[0].boxes[0]
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        
        # Защита от слишком мелких объектов (шума)
        if (x2 - x1) > 40 and (y2 - y1) > 40:
            cropped_image = image.crop((x1, y1, x2, y2))

    # 2. Эмбеддинг очищенного (или оригинального, если ничего не найдено) изображения через CLIP
    inputs = clip_processor(images=cropped_image, return_tensors="pt")
    
    with torch.no_grad():
        outputs = clip_model(**inputs)
        image_features = outputs.image_embeds 
        
    # Нормализуем вектор для корректного поиска косинусного расстояния в pgvector
    image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
    return image_features.squeeze().tolist()