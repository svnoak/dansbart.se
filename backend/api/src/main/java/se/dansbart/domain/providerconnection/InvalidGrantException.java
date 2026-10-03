package se.dansbart.domain.providerconnection;

public class InvalidGrantException extends Exception {

    public InvalidGrantException(String message) {
        super(message);
    }
}
