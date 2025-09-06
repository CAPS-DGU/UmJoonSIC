package com.sicserver.api;

public interface Simulation {
    String load(
            String[] filePaths,
            String outputDirPath,
            String outputName,
            String mainSymbol,
            Boolean keep,
            Boolean graphical,
            Boolean editing,
            Boolean force,
            Boolean verbose
    );

    String syntaxCheck(String[] texts, String[] fileNames);

    String memory(int start);
    String memory(int start, Integer endInclusive);

    String step();
}
