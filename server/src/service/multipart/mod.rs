use anyhow::{anyhow, Context};
use axum::extract::Multipart;
use std::path::PathBuf;
use uuid::Uuid;

pub async fn handle_multipart(mp: &mut Multipart) -> anyhow::Result<String> {
    // iterate through fields and handle the first file field we find
    while let Some(field) = mp.next_field().await? {
        // get original file name
        let orig_name = field
            .file_name()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "file".to_string());

        // ensure content type exists and is an image
        if let Some(ct) = field.content_type() {
            if !ct.starts_with("image/") {
                return Err(anyhow!("uploaded file is not an image"));
            }
        } else {
            return Err(anyhow!("missing content type for uploaded file"));
        }

        // read bytes and enforce 1MB limit
        let data = field.bytes().await.context("reading uploaded file bytes")?;
        const MAX_SIZE: usize = 1 * 1024 * 1024; // 1MB
        if data.len() > MAX_SIZE {
            return Err(anyhow!("uploaded file is too large (max 1MB)"));
        }

        // prepare output path and filename with UID
        let uid = Uuid::new_v4().to_string();
        let p = std::path::Path::new(&orig_name);
        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
        let ext = p.extension().and_then(|s| s.to_str());
        let out_name = if let Some(ext) = ext {
            format!("{}-{}.{}", stem, uid, ext)
        } else {
            format!("{}-{}", stem, uid)
        };

        let mut out_path = PathBuf::from("/tmp/learning_lab");
        tokio::fs::create_dir_all(&out_path).await.context("creating output dir")?;
        out_path.push(out_name);

        // write file
        tokio::fs::write(&out_path, &data).await.context("writing uploaded file")?;

        return Ok(out_path.to_string_lossy().to_string());
    }

    Err(anyhow!("no file found in multipart request"))
}
