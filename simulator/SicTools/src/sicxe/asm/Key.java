package sicxe.asm;

// Put this in your own package, e.g. asm.model or util
public final class Key<T> {
    private final String name;

    private Key(String name) {
        this.name = name;
    }

    public static <T> Key<T> of(String name) {
        return new Key<>(name);
    }

    @Override
    public String toString() {
        return name;
    }
}
