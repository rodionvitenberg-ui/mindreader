# PetMind Backend — Project Status & Roadmap

This document serves as the ground truth and architectural reference point for the PetMind backend application (Django 6 + Celery + PostgreSQL + Redis). It delineates what has been successfully implemented and outlines the precise backlog for incoming developers.

---

## 🏗️ 1. Current Architecture & Implemented Features

The core infrastructure is fully functional, optimized for performance, and designed to handle asynchronous AI workloads without blocking the main thread.

### 🌐 Core Web & Async Infrastructure
- **Django 6 & ASGI Ready:** Built on the latest stable Django framework with native async support capabilities.
- **Celery & Redis Orchestration:** Background task workers configured to handle intense AI model calls. Heavy computations do not block HTTP responses.
- **WhiteNoise Integration:** Configured with compressed manifest storage (`CompressedManifestStaticFilesStorage`) for efficient frontend asset serving.

### 🧠 Database & Vector Space (Face ID for Pets)
- **PostgreSQL Vector Engine:** `pgvector` extension fully integrated and deployed via native Django migrations.
- **HNSW Indexing:** The `pet_profiles` table utilizes an `HnswIndex` with `vector_cosine_ops` for lightning-fast, high-dimensional vector similarity matching (face recognition).
- **Hybrid Data Models:** Combined relational schemas with `JSONB` fields (`image_paths`, `ai_analysis`, `traits_data`) to query deep data structures natively within SQL.

### 🤖 Embedded ML & AI Processing Core
- **Local CLIP Embeddings (`ml_services.py`):** Integrates OpenAI's `clip-vit-base-patch32` via HuggingFace Transformers to convert uploaded images into 512-dimensional vector encodings locally and for free.
- **Lazy Loading Optimization:** Deep learning models are designed to stay out of the web server (Gunicorn) processes and load dynamically only inside active Celery workers, preserving system RAM.
- **DeepSeek Integration & Memory Summary (RAG):** A comprehensive background task (`process_animal_scan`) that fetches face vectors, queries PostgreSQL for matching pet identities within an 85% similarity threshold, aggregates historical textual context, and issues structured JSON completion requests to the DeepSeek API.

### ⚙️ System Settings & Profiles
- **Singleton Configuration Pattern:** The `SystemSettings` model guarantees a single global configuration row in the database (`pk=1`), preventing configuration fragmentation.
- **Tiered Limit Controllers:** Flexible structure allows managing frame capture counts globally via `SystemSettings` or individually through `custom_frame_count` on the кастомная `User` model to adapt to low-end or high-end mobile hardware.

---

## 🛠️ 2. Immediate Tech Debt & Verification Tasks

Before expanding features, the incoming developer must lock down the following core tasks to align the repository with recent endpoint specifications:

1. **Implement `ScanResultView` (Polling Endpoint):**
   - *Status:* Missing in current `views.py`/`urls.py`.
   - *Task:* Create a `GET /api/v1/scan/<int:scan_id>/` view using `get_object_or_404`. It must return the processing status (`pending`, `processing`, `completed`, `failed`). Once `completed`, append the `ai_analysis` payload and `pet_profile_id`.
2. **Environment Variable Sanitization:**
   - *Task:* Move the hardcoded `SECRET_KEY` from `config/settings.py` completely into the local `.env` file and link `DEBUG` to evaluate boolean environment flags strictly.
3. **Bind Request User to Upload View:**
   - *Task:* Update `ScanUploadView` to pass `request.user` into `AnimalScan.objects.create()` if the user context is authenticated, shifting away from default anonymous `None` entries.

---

## 📋 3. Future Feature Backlog (Tasks for the Incoming Developer)

The following modules need to be engineered to bring the MVP to a commercial launch stage:

### 🔐 Task A: Mobile-Ready Authentication (JWT & OAuth2)
- **Problem:** Session-based cookies perform poorly on Progressive Web Apps (PWA) and standalone mobile containers.
- **Requirement:**
  - Integrate `djangorestframework-simplejwt` for stateless token authentication.
  - Implement social login endpoints (Google & Apple Sign-In) via `django-allauth` or custom middleware since mobile users rarely utilize traditional password forms.

### 🐈 Task B: Profile Claiming & Personality Assignment
- **Problem:** New animals currently default to an anonymous "Shadow Profile" (`is_shadow=True`).
- **Requirement:**
  - Build `POST /api/v1/pets/claim/` allowing users to claim ownership of a `pet_profile_id`.
  - Upon claiming, switch `is_shadow` to `False`, associate the pet with the user's account, assign a custom name, and bind an entry from the `AIPersonality` table managed through the admin panel.

### ☁️ Task C: Production Cloud Storage Transition (S3)
- **Problem:** Files are currently read and written locally via the server file system.
- **Requirement:**
  - Transition storage to an production cloud provider (AWS S3, DigitalOcean Spaces, or Yandex Cloud Object Storage) using `django-storages[boto3]`.
  - Ensure `tasks.py` continues to stream image data successfully into PIL using the established `default_storage.open()` abstraction layer.

### 🧹 Task D: Automation & Media Purge (Celery Beat)
- **Problem:** Retaining multiple video frames for every single user scan will quickly exhaust server disk space/S3 budgets.
- **Requirement:**
  - Configure `django-celery-beat`.
  - Write a cron task running nightly to locate `AnimalScan` records older than 30 days, delete their corresponding raw image assets from cloud storage, and clear the `image_paths` array while preserving the textual `ai_analysis` logs.

### 📚 Task E: Automated Almanac Generation
- **Problem:** The `Almanac` entries table needs to populate automatically to create a "species encyclopedia" for players.
- **Requirement:**
  - When DeepSeek classifies a new animal species, check if it exists in the `Almanac` table.
  - If missing, trigger a lightweight background task to fetch structural encyclopedia details (fun facts, temperament, rarity tier) via a cheaper text-based LLM endpoint and store it natively inside `traits_data`.