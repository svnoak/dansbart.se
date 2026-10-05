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

import java.net.URI;
import java.util.UUID;
import java.util.function.Supplier;

@Controller
@RequestMapping("/api/connections")
@Tag(name = "Connections", description = "Connect external music providers")
public class ConnectionController {

    private final GoogleConnectionService googleConnectionService;
    private final HiDriveConnectionService hiDriveConnectionService;
    private final String googleSuccessUrl;
    private final String hiDriveSuccessUrl;

    public ConnectionController(
            GoogleConnectionService googleConnectionService,
            HiDriveConnectionService hiDriveConnectionService,
            @Value("${dansbart.google.success-url:/mina-latar}") String googleSuccessUrl,
            @Value("${dansbart.hidrive.success-url:/mina-latar}") String hiDriveSuccessUrl) {
        this.googleConnectionService = googleConnectionService;
        this.hiDriveConnectionService = hiDriveConnectionService;
        this.googleSuccessUrl = googleSuccessUrl;
        this.hiDriveSuccessUrl = hiDriveSuccessUrl;
    }

    @GetMapping("/google/start")
    @Operation(operationId = "startGoogleConnection", summary = "Redirect to Google to connect Drive")
    public ResponseEntity<Void> startGoogle(@AuthenticationPrincipal UUID userId, HttpSession session) {
        return start(userId, () -> googleConnectionService.start(userId, session));
    }

    @GetMapping("/google/callback")
    @Operation(operationId = "finishGoogleConnection", summary = "Finish the Google Drive connection")
    public ResponseEntity<Void> finishGoogle(
            @AuthenticationPrincipal UUID userId,
            HttpSession session,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String error) {
        return finish(googleConnectionService.callback(userId, session, state, code, error), googleSuccessUrl);
    }

    @GetMapping("/hidrive/start")
    @Operation(operationId = "startHiDriveConnection", summary = "Redirect to HiDrive to connect it")
    public ResponseEntity<Void> startHiDrive(@AuthenticationPrincipal UUID userId, HttpSession session) {
        return start(userId, () -> hiDriveConnectionService.start(userId, session));
    }

    @GetMapping("/hidrive/callback")
    @Operation(operationId = "finishHiDriveConnection", summary = "Finish the HiDrive connection")
    public ResponseEntity<Void> finishHiDrive(
            @AuthenticationPrincipal UUID userId,
            HttpSession session,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String error) {
        return finish(hiDriveConnectionService.callback(userId, session, state, code, error), hiDriveSuccessUrl);
    }

    private ResponseEntity<Void> start(UUID userId, Supplier<URI> authorizationUri) {
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            return redirect(authorizationUri.get().toString());
        } catch (ProviderNotConfiguredException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
    }

    private ResponseEntity<Void> finish(CallbackOutcome outcome, String successUrl) {
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
