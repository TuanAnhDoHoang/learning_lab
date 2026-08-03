use std::env;

use anyhow::Context;
use diesel::{
    PgConnection, r2d2::{self, ConnectionManager, Pool},
};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};

pub type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

pub fn get_pool() -> anyhow::Result<DbPool> {
    let db_url = env::var("DATABASE_URL").context("Missing Database Url")?;

    let manager = ConnectionManager::<PgConnection>::new(db_url);
    let pool = Pool::builder()
        .test_on_check_out(true)
        .build(manager)
        .context("Could not  build connection pool")?;
    Ok(pool)
}

pub fn migration(pool: &DbPool) -> anyhow::Result<()> {
    let mut conn = pool
        .get()
        .expect("Failed to get a connection from the pool for migrations");
    println!("Đang kiểm tra và chạy Database Migrations...");
    conn.run_pending_migrations(MIGRATIONS)
        .expect("Chạy database migration thất bại!");
    println!("Database Migrations hoàn tất thành công!");
    Ok(())
}
