# pac
A Pacman wrapper in Bash that is intended for Arch (archlinux) noobs or anyone who likes friendly TUI's (text user interfaces).

Are you an archlinux noob who really likes Arch but is frustrated by `pacman`'s many idiosyncrasies even when performing common tasks?

Are you tired of running `man pacman` every other time you need to use it for something that should be simple?

Does your idea of "simple" include easy-to-recall commands like `pac up` to update everything, `pac outdated` to identify outdated libs WITHOUT updating the main local package DB (yep, `pacman` does that by default, even though it specifically recommends NOT DOING THAT argghhh), or `pac search`, `pac install`/`pac remove` to do, well, those common things? (And also not accidentally be aggressive at deleting deps that may be required by other deps, thus breaking things?)

I have a possible solution! PAC! A wrapper for `pacman` which prioritizes user-friendliness. As an example of this design, aliases to common commands are included which are invariably synonyms, so for example `pac uninstall` and `pac remove` do the same thing. Ever wonder whether you have to use `search`, `query` or `find`? Well, now ya don't! (I don't want to have to remember the right form of argument to pass, just interpret it semantically, try not to break stuff, and DO IT!)

Dependencies: Archlinux, `pacman`, a recent `bash` version.

INSTALLATION: Just put `pac` in your `PATH`. Make sure it's executable. Done. (Note on `PATH` manipulation: My binfiles have a pretty useful idempotent `PATH` prepender function here: https://github.com/pmarreck/dotfiles/blob/master/.pathconfig)

Note: In some cases you will be asked to rerun as `sudo` if needed.

### Configuration

      Set `PAC_USE_AUR` env variable to include the AUR- This currently depends on and requires the installation of "yay".
      Set `PAC_MUTE_CMD_ECHO` env variable to stop pac from printing out the underlying command it will run before it runs it.

### Usage 

      pac install | i | upgrade | update | up | system_upgrade | su [--force-refresh] [<packagename>]
         (These are all essentially synonyms.)
         Updates the local package db, upgrades local packages, then optionally installs a package.
         For the reasons why you shouldn't update the local package db without also upgrading all packages,
         and why you shouldn't install anything new without first doing the above, see the arch docs.
         --force-refresh forces a sync update across all repos and forces reinstalls on any installation
         (normally, anything already installed is skipped).

      pac uninstall | u | remove | r [--orphaned | --gone] [<packagename>]
         Uninstalls a package and removes any dependencies that aren't needed by something else
         (but non-aggressively).
         --orphaned uninstalls any deps not needed by anything which might have been missed.
         --gone uninstalls any deps which aren't listed in any known repos
         (note: may include manually-installed packages!)

      pac orphaned | o
         List any orphaned deps.

      pac list | l
         List locally-installed packages.

      pac inspect | info <packagename>
         Prints out detailed information about a package.

      pac files <packagename>
         What files WOULD this package install?

      pac owns <path/to/file>
         What package owns this file? (Can also name any executable in PATH.)

      pac search | s | query | q | find | f [--local | --remote] <expression>
         Searches package names and descriptions with an expression which can be a regex.
         --local searches the local package db, --remote searches the remote db.
         Default is --remote.

      pac clean | c | purge
         Cleans out all cached or partially-downloaded data.

      pac outdated | stale
         Returns a list of local packages which have a newer remote version.
         NOTE: Unlike the naïve solution, this does NOT update the main local package db first!
         (Which was very important to keep things in sync. Rolling distro, and all that.)

      pac deptree <packagename>
         Print out a dependency tree for both the packages this package depends on,
         and the other packages dependent on it.

      pac needed_by | deps [--flat | --unique] <packagename>
         Packages that the named package depends on (as a tree).
         The two options return a uniquified flat list instead of a tree
         (suitable for outputting to other commands).

      pac needs | depends_on [--flat | --unique] <packagename>
         Packages that are dependent on the named package (as a tree).
         The two options return a uniquified flat list instead of a tree
         (suitable for outputting to other commands).

      pac valid[ate] <packagename>
         Thoroughly checks that all the files belonging to the package are valid.

      pac unlock
         Unlocks the package lock, in the event it was inadvertently left locked. 
         May require sudo.
         Make sure there isn't another package update running in another terminal!
         (Inspecting processes to find other pacmans might be a future feature update.)

      pac doc[tor]
         Checks various things in the package system to identify discrepancies.
         Probably incomplete, happy to take PR's to improve this.

## Future improvements?

1) Still testing AUR interop, so far so good... (currently this depends on `yay` being installed and the `PAC_USE_AUR` env var being set)

2) Include relevant posts scraped from the archlinux RSS feed about packages being updated, before updating them, so you can catch warnings and whatnot and bail if necessary

3) Anything you can think of to make this easier and/or safer and/or more powerful without adding a ton of `bash` code. Now accepting PR's.
