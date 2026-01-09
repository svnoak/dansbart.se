from pydantic_settings import BaseSettings, SettingsConfigDict # Added SettingsConfigDict
from pydantic import PostgresDsn, computed_field

class Settings(BaseSettings):
    # Database
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "dansbart"

    # Spotify
    SPOTIPY_CLIENT_ID: str
    SPOTIPY_CLIENT_SECRET: str

    # Admin
    ADMIN_PASSWORD: str

    # Authentik OIDC Configuration
    AUTHENTIK_ISSUER: str
    AUTHENTIK_JWKS_URI: str
    AUTHENTIK_CLIENT_ID: str
    AUTHENTIK_CLIENT_SECRET: str
    AUTHENTIK_REDIRECT_URI: str

    # Frontend URL
    FRONTEND_URL: str = "http://localhost:8080"

    @computed_field
    def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn:
        return PostgresDsn.build(
            scheme="postgresql+psycopg2",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )

    # Configuration to handle .env file
    model_config = SettingsConfigDict(
        env_file=".env", 
        extra="ignore" # Safety net: ignore other random variables in .env
    )

settings = Settings()