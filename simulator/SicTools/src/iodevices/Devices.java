package iodevices;

import java.util.logging.Logger;

public class Devices {

    private static final Logger LOG = Logger.getLogger(Devices.class.getName());

    private Device[] devices;

    public Device getDevice(int idx) {
        return devices[idx];
    }

    public void setDevice(int idx, Device device) {
        devices[idx] = device;
    }

    public void addFileDevice(int idx, String filePath) {

        devices[idx] = new FileDevice(filePath);
    }

    private String byteToHex(int value) {
        return String.format("%02X", value & 0xFF);
    }

    private boolean checkDeviceIndex(int idx) {
        boolean invalid = idx < 0 || idx >= devices.length;
        if (invalid) LOG.severe(String.format("Invalid device number '%d'.", idx));
        return invalid;
    }

    public int read(int idx) {
        if (checkDeviceIndex(idx)) {
            LOG.severe(String.format("Invalid device number '%d'.", idx));
            return 0;
        }
        int val = devices[idx].read();
        if (val < 0 || val > 255) val = 0;
        return val;
    }

    public void write(int idx, int val) {
        if (checkDeviceIndex(idx))
            LOG.severe(String.format("Invalid device number '%d'.", idx));
        else
            devices[idx].write(val & 0xFF);
    }

    public boolean test(int idx) {
        if (checkDeviceIndex(idx)) {
            LOG.severe(String.format("Invalid device number '%d'.", idx));
            return false;
        }
        return devices[idx].test();
    }

    public Devices(int count) {
        assert count > 2;
        devices = new Device[count];
        for (int i = 0; i < count; i++)
            setDevice(i, new Device());
    }
}
