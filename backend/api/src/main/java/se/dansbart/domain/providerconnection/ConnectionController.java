package se.dansbart.domain.providerconnection;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.UUID;

/** Connects a provider, for example {@code /api/connections/google/start}. The slugs come from the connectors. */
@Controller
@RequestMapping("/api/connections")
@Tag(name = "Connections", description = "Connect external music providers")
public class ConnectionController {

    private final OAuthConnectionService connectionService;
    private final String successUrl;

    public ConnectionController(
            OAuthConnectionService connectionService,
            @Value("${dansbart.connections.success-url:/mina-latar}") String successUrl) {
        this.connectionService = connectionService;
        this.successUrl = successUrl;
    }

    @GetMapping("/{provider}/start")
    @Operation(operationId = "startConnection", summary = "Redirect to the provider to connect it")
    public ResponseEntity<Void> start(
            @PathVariable String provider, @AuthenticationPrincipal UUID userId, HttpSession session) {
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            return redirect(connectionService.start(provider, userId, session).toString());
        } catch (UnknownProviderException e) {
            return ResponseEntity.notFound().build();
        } catch (ProviderNotConfiguredException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
    }

    @GetMapping("/{provider}/callback")
    @Operation(operationId = "finishConnection", summary = "Finish the connection after the provider consent")
    public ResponseEntity<Void> callback(
            @PathVariable String provider,
            @AuthenticationPrincipal UUID userId,
            HttpSession session,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String error) {
        CallbackOutcome outcome;
        try {
            outcome = connectionService.callback(provider, userId, session, state, code, error);
        } catch (UnknownProviderException e) {
            return ResponseEntity.notFound().build();
        }
        return redirect(switch (outcome) {
            case CONNECTED -> successUrl;
            case DECLINED -> successUrl + "?anslutning=avbruten";
            case FAILED, REJECTED -> successUrl + "?anslutning=misslyckades";
        });
    }

    private ResponseEntity<Void> redirect(String location) {
        return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, location).build();
    }
}
