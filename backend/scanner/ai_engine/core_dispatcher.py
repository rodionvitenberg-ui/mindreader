from .prompt_builders import build_monolithic_xml_prompt
from .personalities.protagonist_cat.py import get_protagonist_instruction
from ..models import UserScannerProfile

def prepare_ai_payload(matched_profile, device_id):
    """
    Определяет режим работы сканера, вытаскивает уровень юзера из БД 
    и генерирует финальный промпт для Gemini.
    """
    # Ищем или создаем профиль прокачки девайса
    scanner_profile, _ = UserScannerProfile.objects.get_or_create(device_id=device_id)
    current_level = scanner_profile.current_level

    # Проверяем, кто перед нами. Если это призрак человека/предмета (мы заложим логику детекции)
    # Или если к профилю не привязана дефолтная личность животного, мы можем динамически переключаться
    is_protagonist_mode = matched_profile.is_shadow  # К примеру, теневые профили по умолчанию проверяются Майндридером

    if is_protagonist_mode:
        system_base = get_protagonist_instruction(current_level)
        memory_context = matched_profile.memory_summary
        is_real_protagonist = True
    else:
        system_base = matched_profile.personality.system_prompt if matched_profile.personality else "Humorous pet mind reader"
        memory_context = matched_profile.memory_summary
        is_real_protagonist = False

    full_prompt = build_monolithic_xml_prompt(system_base, memory_context, is_real_protagonist)
    return full_prompt, current_level