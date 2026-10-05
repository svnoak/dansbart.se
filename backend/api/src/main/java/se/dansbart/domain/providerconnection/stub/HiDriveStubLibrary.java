package se.dansbart.domain.providerconnection.stub;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The files the HiDrive stub serves: a fixed folder tree with short generated WAV tones, so that the
 * repository holds no audio and the stub works offline.
 */
public class HiDriveStubLibrary {

    public static final String HOME = "/users/lokal.dansare";

    private static final int SAMPLE_RATE = 8000;
    private static final double SECONDS = 2.0;

    public record Entry(String name, String path, String type, long size, String mimeType) {
    }

    public record Listing(String path, String name, List<Entry> members) {
    }

    private record Tone(String path, double hertz) {
    }

    private static final List<Tone> TONES = List.of(
        new Tone(HOME + "/Polskor/Bingsjöpolska.wav", 330),
        new Tone(HOME + "/Polskor/Polska efter Pekkos Per.wav", 392),
        new Tone(HOME + "/Schottis/Schottis från Haverö.wav", 440),
        new Tone(HOME + "/Gånglåt från Äppelbo.wav", 494));

    private final Map<String, byte[]> files = new LinkedHashMap<>();

    public HiDriveStubLibrary() {
        for (Tone tone : TONES) {
            files.put(tone.path(), wavTone(tone.hertz()));
        }
    }

    public Optional<byte[]> file(String path) {
        return Optional.ofNullable(files.get(path));
    }

    /** Lists a folder like HiDrive's {@code GET /dir}. An empty or null path means the home folder. */
    public Optional<Listing> list(String path) {
        String folder = (path == null || path.isBlank()) ? HOME : stripTrailingSlash(path);
        if (!folder.equals(HOME) && !folder.startsWith(HOME + "/")) {
            return Optional.empty();
        }
        Map<String, Entry> members = new LinkedHashMap<>();
        for (Map.Entry<String, byte[]> file : files.entrySet()) {
            String filePath = file.getKey();
            if (!filePath.startsWith(folder + "/")) {
                continue;
            }
            String rest = filePath.substring(folder.length() + 1);
            int slash = rest.indexOf('/');
            if (slash < 0) {
                members.put(rest, new Entry(rest, filePath, "file", file.getValue().length, "audio/wav"));
            } else {
                String child = rest.substring(0, slash);
                members.putIfAbsent(child, new Entry(child, folder + "/" + child, "dir", 0, null));
            }
        }
        if (members.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new Listing(folder, nameOf(folder), List.copyOf(members.values())));
    }

    private static String stripTrailingSlash(String path) {
        return path.length() > 1 && path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
    }

    private static String nameOf(String path) {
        return path.substring(path.lastIndexOf('/') + 1);
    }

    /** A mono 16-bit PCM WAV with a sine tone, deterministic for a given pitch. */
    static byte[] wavTone(double hertz) {
        int samples = (int) (SAMPLE_RATE * SECONDS);
        int dataBytes = samples * 2;
        ByteBuffer buffer = ByteBuffer.allocate(44 + dataBytes).order(ByteOrder.LITTLE_ENDIAN);
        buffer.put("RIFF".getBytes(StandardCharsets.US_ASCII));
        buffer.putInt(36 + dataBytes);
        buffer.put("WAVE".getBytes(StandardCharsets.US_ASCII));
        buffer.put("fmt ".getBytes(StandardCharsets.US_ASCII));
        buffer.putInt(16);
        buffer.putShort((short) 1);
        buffer.putShort((short) 1);
        buffer.putInt(SAMPLE_RATE);
        buffer.putInt(SAMPLE_RATE * 2);
        buffer.putShort((short) 2);
        buffer.putShort((short) 16);
        buffer.put("data".getBytes(StandardCharsets.US_ASCII));
        buffer.putInt(dataBytes);
        for (int i = 0; i < samples; i++) {
            double fade = Math.min(1.0, Math.min(i, samples - i) / (SAMPLE_RATE * 0.05));
            double value = Math.sin(2 * Math.PI * hertz * i / SAMPLE_RATE) * 0.4 * fade;
            buffer.putShort((short) Math.round(value * Short.MAX_VALUE));
        }
        return buffer.array();
    }
}
