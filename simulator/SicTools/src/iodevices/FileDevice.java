package iodevices;

import java.io.IOException;
import java.io.FileNotFoundException;
import java.io.RandomAccessFile;
import java.util.logging.Logger;

public class FileDevice extends Device {

    private static final Logger LOG = Logger.getLogger(FileDevice.class.getName());

    private String filename;
    private RandomAccessFile file;

    private void openFile() {
        try {
            file = new RandomAccessFile(filename, "rw");
        } catch (FileNotFoundException e) {
            LOG.severe(String.format("Cannot open file '%s'", filename));
        }
    }

    @Override
    public int read() {
        if (file == null) openFile();
        if (file == null) return super.read();
        try {
            return file.read();
        } catch (IOException e) {
            LOG.severe(String.format("Cannot read from file '%s'", filename));
            return super.read();
        }
    }

    @Override
    public void write(int value) {
        if (file == null) openFile();
        if (file == null) return;
        try {
            file.write(value);
        } catch (IOException e) {
            LOG.severe(String.format("Cannot write to file '%s'", filename));
        }
    }

    @Override
    public void reset() {
        if (file == null) return;
        try {
            file.close();
            file = null;
        } catch (IOException e) {
            LOG.severe(String.format("Cannot reset file '%s'", filename));
        }
    }

    public FileDevice(String filename) {
        this.filename = filename;
    }
}
