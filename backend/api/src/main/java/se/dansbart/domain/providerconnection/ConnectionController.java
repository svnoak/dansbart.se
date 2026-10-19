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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.UUID;

@Controller
@RequestMapping("/api/connections/google")
@Tag(name = "Connections", description = "Connect external music providers")
public class ConnectionController {

    private final GoogleConnectionService googleConnectionService;
    private final String successUrl;

    public ConnectionController(
            GoogleConnectionService googleConnectionService,
            @Value("${dansbart.google.success-url:/mina-latar}") String successUrl) {
        this.googleConnectionService = googleConnectionService;
        this.successUrl = successUrl;
    }

    @GetMapping("/start")
    @Operation(operationId = "startGoogleConnection", summary = "Redirect to Google to connect Drive")
    public ResponseEntity<Void> start(@AuthenticationPrincipal UUID userId, HttpSession session) {
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            return redirect(googleConnectionService.start(userId, session).toString());
        } catch (GoogleNotConfiguredException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
    }

    @GetMapping("/callback")
    @Operation(operationId = "finishGoogleConnection", summary = "Finish the Google Drive connection")
    public ResponseEntity<Void> callback(
            @AuthenticationPrincipal UUID userId,
            HttpSession session,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String error) {
        CallbackOutcome outcome = googleConnectionService.callback(userId, session, state, code, error);
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
