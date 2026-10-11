package se.dansbart.exception;

/** A call to an outside service such as Spotify or YouTube failed. Maps to 502. */
public class ExternalServiceException extends RuntimeException {

    public ExternalServiceException(String message) {
        super(message);
    }

    public ExternalServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
