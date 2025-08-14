package sic.sim;

import com.google.gwt.core.client.GWT;
import com.google.gwt.user.client.Timer;
import sic.sim.breakpoints.Breakpoints;
import sic.sim.breakpoints.DataBreakpointException;
import sic.sim.breakpoints.DataBreakpoints;
import sic.sim.vm.Machine;

/**
 * Manages the execution flow of the SIC/XE virtual machine.
 * This class handles running, stopping, stepping, and managing the execution speed,
 * while respecting breakpoints. It is designed to be compatible with GWT for
 * web-based environments.
 */
public class Executor {

    /**
     * A functional interface to define a condition for stopping the execution.
     * This is a GWT-compatible replacement for java.util.function.Predicate.
     */
    @FunctionalInterface
    public interface StopCondition {
        boolean test(Machine machine);
    }

    /**
     * A listener interface to handle breakpoint events.
     * This is a GWT-compatible replacement for java.awt.event.ActionListener.
     */
    @FunctionalInterface
    public interface BreakpointListener {
        void onBreakpointHit();
    }

    public static final int MAX_SPEED_HZ = 100_000_000;

    public final Machine machine;
    public final Breakpoints breakpoints;
    private final DataBreakpoints dataBreakpoints;

    private Timer executionTimer;
    private int timerPeriodMs;
    private int instructionsPerTick;
    private boolean hasChanged;
    private boolean shouldPrintStats = false;

    private BreakpointListener breakpointListener;

    public Executor(final Machine machine) {
        this.machine = machine;
        this.breakpoints = new Breakpoints();
        this.dataBreakpoints = machine.memory.dataBreakpoints;
        this.dataBreakpoints.enable();
        setSpeed(100); // Default speed
    }

    public Executor(final Machine machine, Args arg) {
        this(machine);
        this.shouldPrintStats = arg.isStats();
        if (arg.getFreq() > 0) {
            setSpeed(arg.getFreq());
        }
    }

    public Machine getMachine() {
        return machine;
    }

    public void setBreakpointListener(BreakpointListener listener) {
        this.breakpointListener = listener;
    }

    public int getSpeed() {
        if (timerPeriodMs == 0) return 0;
        return (1000 / timerPeriodMs) * instructionsPerTick;
    }

    public void setSpeed(int hertz) {
        if (hertz > MAX_SPEED_HZ) hertz = MAX_SPEED_HZ;
        if (hertz <= 0) hertz = 1;
        // Aim for around 100 ticks per second for responsiveness
        int ticksPerSecond = 100;
        this.instructionsPerTick = (hertz + ticksPerSecond - 1) / ticksPerSecond;
        this.timerPeriodMs = 1000 * instructionsPerTick / hertz;
    }

    public boolean isRunning() {
        return executionTimer != null;
    }

    public boolean hasChanged() {
        boolean changed = hasChanged;
        hasChanged = false;
        return changed;
    }

    public void start() {
        // Start with a condition that is never met, so it runs indefinitely.
        runUntil(m -> false);
    }

    public void runToAddress(int stopAddress) {
        runUntil(m -> m.registers.getPC() == stopAddress);
    }



    public void stepOut() {
        Integer returnAddress = machine.getAddressBelowLastJSUB();
        if (returnAddress != null) {
            runUntil(m -> m.registers.getPC() == returnAddress);
        }
    }

    public void stop() {
        if (!isRunning()) return;
        executionTimer.cancel();
        executionTimer = null;
        if (shouldPrintStats) {
            GWT.log("Instructions executed: " + machine.getInstructionCount());
        }
    }

    public void step() {
        if (isRunning()) return;

        boolean wereDataBreakpointsEnabled = dataBreakpoints.isEnabled();
        dataBreakpoints.disable();

        try {
            machine.execute();
        } catch (DataBreakpointException ex) {
            // This should not be triggered as we disabled the breakpoints,
            // but we log it just in case.
            GWT.log("DataBreakpointException was caught during a step operation: " + ex.getMessage());
        }

        if (wereDataBreakpointsEnabled) {
            dataBreakpoints.enable();
        }
        hasChanged = true;
    }

    private void runUntil(StopCondition stopCondition) {
        if (isRunning()) return;

        executionTimer = new Timer() {
            @Override
            public void run() {
                executeTick(stopCondition);
            }
        };
        executionTimer.scheduleRepeating(timerPeriodMs);
    }

    private void executeTick(StopCondition stopCondition) {
        for (int i = 0; i < instructionsPerTick; i++) {
            int oldPC = machine.registers.getPC();

            try {
                machine.execute();
                // Re-enable data breakpoints if they were triggered and disabled on the previous cycle.
                if (!dataBreakpoints.isEnabled()) {
                    dataBreakpoints.enable();
                }
            } catch (DataBreakpointException ex) {
                // Instruction failed, so reset PC to its state before the attempt.
                machine.registers.setPC(oldPC);
                handleBreakpointHit();
                return; // Stop this tick
            }

            hasChanged = true;

            // Check for HALT condition (PC did not advance)
            if (oldPC == machine.registers.getPC()) {
                stop();
                return; // Stop this tick
            }

            // Check for execution breakpoint
            if (breakpoints.has(machine.registers.getPC())) {
                handleBreakpointHit();
                return; // Stop this tick
            }

            // Check for custom stop condition
            if (stopCondition.test(machine)) {
                stop();
                return; // Stop this tick
            }
        }
    }

    private void handleBreakpointHit() {
        hasChanged = true;
        stop();
        if (breakpointListener != null) {
            breakpointListener.onBreakpointHit();
        }
    }
}
