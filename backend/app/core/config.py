from pydantic_settings import BaseSettings, SettingsConfigDict # Added SettingsConfigDict
from pydantic import PostgresDsn, computed_field

class Settings(BaseSettings):
    # Database (Existing)
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "folkmusic_db"
    
    # Spotify (NEW: Add these lines)
    SPOTIPY_CLIENT_ID: str
    SPOTIPY_CLIENT_SECRET: str

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