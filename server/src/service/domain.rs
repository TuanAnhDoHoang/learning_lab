use crate::postgres::schema::Domain;
use crate::schema::domain;
use diesel::query_dsl::methods::FilterDsl;
use diesel::ExpressionMethods;
use diesel::Insertable;
use diesel::OptionalExtension;
use diesel::PgConnection;
use diesel::QueryableByName;
use diesel::RunQueryDsl;
#[derive(Debug, Insertable, QueryableByName)]
#[table_name = "domain"]
pub struct NewDomain<'a> {
    pub name: &'a str,
}

pub fn new_domain(name: &str, conn: &mut PgConnection) -> anyhow::Result<Domain> {
    let new_domain: NewDomain<'_> = NewDomain { name };
    let inserted_domain: Domain = diesel::insert_into(domain::table)
        .values(&new_domain)
        .get_result(conn)?;
    Ok(inserted_domain)
}

pub fn get_existed_domain(name: &str, conn: &mut PgConnection) -> anyhow::Result<Option<Domain>> {
    let domain_existed: Option<Domain> = domain::table
        .filter(domain::name.eq(name))
        .first::<Domain>(conn)
        .optional()?; // Dùng `?` trực tiếp của Diesel
    Ok(domain_existed)
}

