package sic.gwt;

import com.google.gwt.core.client.EntryPoint;

/**
 * A minimal entry point to satisfy the GWT compiler for a library build.
 * This class is referenced in SicToolsCore.gwt.xml.
 */
public class LibraryEntryPoint implements EntryPoint {
    @Override
    public void onModuleLoad() {
        // No-op. The library functions are exposed statically via JsInterop.
    }
}