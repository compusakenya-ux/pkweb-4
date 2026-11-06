# ============================================================================
# SENA Mobility — Google Cloud Platform (GCP) Terraform Infrastructure
# Provisions: Cloud Run v2, Cloud Storage (3D Assets), Artifact Registry,
# and Secret Manager for Meta Business WhatsApp Cloud API Credentials.
# ============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
  }
}

variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
  default     = "sena-mobility-ke-prod"
}

variable "region" {
  description = "Primary GCP Region (Johannesburg / Africa or Europe)"
  type        = string
  default     = "africa-south1"
}

variable "meta_business_account_id" {
  description = "Meta Business Account ID linked to SENA WhatsApp Business"
  type        = string
  default     = "104829104928174"
}

variable "meta_phone_number_id" {
  description = "Meta WhatsApp Business Cloud API Phone Number ID"
  type        = string
  default     = "118492019482719"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# 1. Google Artifact Registry Repository for Cloud Run Container Images
resource "google_artifact_registry_repository" "sena_containers" {
  location      = var.region
  repository_id = "sena-containers"
  description   = "Docker container repository for SENA 3D Landing Page and Meta WhatsApp Webhook"
  format        = "DOCKER"
}

# 2. Google Cloud Storage Bucket for 3D High-Clarity Media Assets
resource "google_storage_bucket" "sena_3d_assets" {
  name                        = "${var.project_id}-3d-assets"
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "OPTIONS"]
    response_header = ["Content-Type", "Cache-Control", "Access-Control-Allow-Origin"]
    max_age_seconds = 3600
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
}

# 2. Google Secret Manager for Meta Business WhatsApp Credentials
resource "google_secret_manager_secret" "meta_whatsapp_token" {
  secret_id = "meta-whatsapp-token"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "meta_webhook_verify" {
  secret_id = "meta-webhook-verify"
  replication {
    auto {}
  }
}

# 3. Google Cloud Run v2 Service hosting the 3D Landing Page & WhatsApp Bot
resource "google_cloud_run_v2_service" "sena_landing_service" {
  name     = "sena-3d-landing"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 15
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/sena-containers/sena-3d-landing:latest"

      ports {
        container_port = 8080
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCS_ASSETS_BUCKET"
        value = google_storage_bucket.sena_3d_assets.name
      }
      env {
        name  = "META_BUSINESS_ACCOUNT_ID"
        value = var.meta_business_account_id
      }
      env {
        name  = "META_PHONE_NUMBER_ID"
        value = var.meta_phone_number_id
      }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }
    }
  }

  depends_on = [google_artifact_registry_repository.sena_containers]
}

# 4. Allow Public Unauthenticated HTTPS Access to SENA Landing Page & Webhook
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = google_cloud_run_v2_service.sena_landing_service.project
  location = google_cloud_run_v2_service.sena_landing_service.location
  name     = google_cloud_run_v2_service.sena_landing_service.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "cloud_run_url" {
  description = "Deployed URL of SENA 3D Landing Page & Meta WhatsApp Webhook"
  value       = google_cloud_run_v2_service.sena_landing_service.uri
}

output "gcs_assets_bucket" {
  description = "GCS Bucket hosting the 3D high-clarity media assets"
  value       = google_storage_bucket.sena_3d_assets.url
}
