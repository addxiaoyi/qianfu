import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

public class GenHash {
  public static void main(String[] args) throws Exception {
    String raw = args.length > 0 ? args[0] : System.getenv("PASSWORD_TO_HASH");
    if (raw == null || raw.isBlank()) {
      throw new IllegalArgumentException("Pass the password as argv[0] or PASSWORD_TO_HASH; never store it in source code.");
    }
    int iterations = 120000;
    int keyLength = 256;
    byte[] salt = new byte[16];
    new SecureRandom().nextBytes(salt);
    PBEKeySpec spec = new PBEKeySpec(raw.toCharArray(), salt, iterations, keyLength);
    SecretKeyFactory keyFactory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
    byte[] derived = keyFactory.generateSecret(spec).getEncoded();
    System.out.println("pbkdf2$" + iterations + "$" + Base64.getEncoder().encodeToString(salt) + "$" + Base64.getEncoder().encodeToString(derived));
  }
}
