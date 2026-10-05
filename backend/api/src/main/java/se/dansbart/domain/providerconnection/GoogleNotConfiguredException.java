package se.dansbart.domain.providerconnection;

public class GoogleNotConfiguredException extends RuntimeException {

    public GoogleNotConfiguredException() {
        super("Google Drive is not configured");
    }
}
