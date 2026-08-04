use std::env;

use anyhow::Context;
use diesel::{
    connection::SimpleConnection,
    r2d2::{self, ConnectionManager, Pool},
    sql_query, PgConnection, RunQueryDsl,
};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

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

#[derive(diesel::QueryableByName)]
struct CountResult {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    count: i64,
}

pub fn seed_data(pool: &DbPool) -> anyhow::Result<()> {
    let mut conn = pool
        .get()
        .expect("Failed to get a connection from the pool for migrations");

    // Chỉ seed nếu bảng domain đang trống -> tránh lỗi trùng khóa khi restart
    let count: i64 = sql_query("SELECT COUNT(*) as count FROM domain")
        .get_result::<CountResult>(&mut conn)
        .map(|r| r.count)
        .unwrap_or(0);

    if count == 0 {
        let seed_sql = include_str!("../seeds/init.sql");
        conn.batch_execute(seed_sql).expect("Failed to seed data");
        println!("✅ Seed data inserted.");
    } else {
        println!("ℹ️ Domain table already has data, skip seeding.");
    }
    Ok(())
}
