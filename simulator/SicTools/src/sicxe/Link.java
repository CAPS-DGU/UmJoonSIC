package sicxe;

import sicxe.link.*;

import java.io.File;
import java.util.ArrayList;
import java.util.List;


/*
 * SIC/XE Linker
 *
 * start linker by calling this class
 * run "java sic.Link -help" for all available options or
 *     "java sic.Link -gui" for graphical interface
 *
 */
public class Link {

    /*
     * processes args into Options class and list of input files
     * calls LinkerGui or LinkerCli based on entered options
     */
    public static void main(String[] args) {
        try {
            // get options
            Options options = new Options();
            int processedArgs = options.processFlags(args);

            // get the input files
            List<String> inputs = new ArrayList<>();

            for (int i=processedArgs; i<args.length; i++)
                inputs.add(args[i]);
        } catch (LinkerError le) {
            System.err.println(le.getMessage());
        }
    }

}
