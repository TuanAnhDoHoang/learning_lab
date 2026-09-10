use axum::{
    extract::multipart::{Field, Multipart},
    http::StatusCode,
};

use super::types::CreateExamByImageRequest;

/// Reads a multipart exam upload and extracts both the JSON payload and the image file.
///
/// # Returns
/// - `Ok((CreateExamByImageRequest, String))`: the validated payload and the temporary image path.
/// - `Err((StatusCode, String))`: any malformed multipart, invalid payload, or image validation issue.
pub async fn extract_exam_payload_and_image(
    multipart: &mut Multipart,
) -> Result<(CreateExamByImageRequest, String), (StatusCode, String)> {
    let mut payload_opt: Option<CreateExamByImageRequest> = None;
    let mut saved_image_path: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("multipart read error: {}", e)))?
    {
        if let Some(name) = field.name() {
            if name == "payload" {
                let text = field
                    .text()
                    .await
                    .map_err(|e| (StatusCode::BAD_REQUEST, format!("reading payload part: {}", e)))?;
                let payload: CreateExamByImageRequest = serde_json::from_str(&text)
                    .map_err(|e| (StatusCode::BAD_REQUEST, format!("invalid payload json: {}", e)))?;
                payload_opt = Some(payload);
                continue;
            }
        }

        if saved_image_path.is_none() {
            let path = save_uploaded_image(field).await?;
            saved_image_path = Some(path);
        }
    }

    let payload = payload_opt.ok_or_else(|| {
        (StatusCode::BAD_REQUEST, "missing payload part in multipart".to_string())
    })?;
    let image_path = saved_image_path.ok_or_else(|| {
        (StatusCode::BAD_REQUEST, "missing image file in multipart".to_string())
    })?;

    Ok((payload, image_path))
}

/// Saves the uploaded image to a temporary path under `/tmp/learning_lab`.
///
/// # Returns
/// - `Ok(String)`: the final temporary file path.
/// - `Err((StatusCode, String))`: invalid file type, oversized file, or write error.
async fn save_uploaded_image(field: Field<'_>) -> Result<String, (StatusCode, String)> {
    let orig_name = field
        .file_name()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "file".to_string());

    if let Some(content_type) = field.content_type() {
        if !content_type.starts_with("image/") {
            return Err((StatusCode::BAD_REQUEST, "uploaded file is not an image".to_string()));
        }
    } else {
        return Err((StatusCode::BAD_REQUEST, "missing content type for uploaded file".to_string()));
    }

    let data = field
        .bytes()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("reading uploaded file bytes: {}", e)))?;

    const MAX_SIZE: usize = 1 * 1024 * 1024; // 1MB
    if data.len() > MAX_SIZE {
        return Err((StatusCode::BAD_REQUEST, "uploaded file is too large (max 1MB)".to_string()));
    }

    let uid = uuid::Uuid::new_v4().to_string();
    let path = std::path::Path::new(&orig_name);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let ext = path.extension().and_then(|s| s.to_str());
    let out_name = if let Some(ext) = ext {
        format!("{}-{}.{}", stem, uid, ext)
    } else {
        format!("{}-{}", stem, uid)
    };

    let mut out_path = std::path::PathBuf::from("/tmp/learning_lab");
    tokio::fs::create_dir_all(&out_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("creating output dir: {}", e)))?;
    out_path.push(out_name);
    tokio::fs::write(&out_path, &data)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("writing uploaded file: {}", e)))?;

    Ok(out_path.to_string_lossy().to_string())
}
