package se.dansbart.domain.providerconnection;

public interface ProviderConnector {

    String provider();

    RefreshedToken refresh(String refreshToken) throws InvalidGrantException;
}
