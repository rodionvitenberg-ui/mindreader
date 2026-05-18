from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import torch

# Загружаем модель в память (при старте воркера это займет пару секунд)
# Используем базовую модель CLIP от OpenAI (она как раз выдает вектор на 512 чисел)
model_id = "openai/clip-vit-base-patch32"

print("Loading CLIP model to RAM... This happens only once.")
model = CLIPModel.from_pretrained(model_id)
processor = CLIPProcessor.from_pretrained(model_id)

def get_image_embedding(image_path):
    """
    Принимает путь к картинке на диске, отдает вектор (список из 512 float).
    """
    image = Image.open(image_path).convert("RGB")
    
    # Готовим тензоры
    inputs = processor(images=image, return_tensors="pt")
    
    # Прогоняем через модель без обновления градиентов (экономит память)
    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
        
    # Нормализуем вектор (обязательно для косинусного сходства)
    image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
    
    # Превращаем тензор PyTorch в обычный Python-список
    return image_features.squeeze().tolist()