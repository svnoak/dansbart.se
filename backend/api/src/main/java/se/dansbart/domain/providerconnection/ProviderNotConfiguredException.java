package se.dansbart.domain.providerconnection;

/** The provider has no OAuth client configured, so nobody can connect it. */
public class ProviderNotConfiguredException extends RuntimeException {
    public ProviderNotConfiguredException(String provider) {
        super(provider + " is not configured");
    }
}
