package se.dansbart.domain.providerconnection;

/** No connector answers to the provider name in the URL. */
public class UnknownProviderException extends RuntimeException {
    public UnknownProviderException(String slug) {
        super("No provider is called " + slug);
    }
}
