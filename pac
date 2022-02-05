#!/usr/bin/env bash

#######################
# PAC: A Saner Pacman #
#######################

# graceful dependency enforcement
# Usage: needs <executable> [provided by <packagename> or explain how to get it here]
needs() {
  local bin=$1
  shift
  command -v $bin >/dev/null 2>&1 || { echo >&2 "I require $bin but it's not installed or in PATH; $*"; return 1; }
}

# ANSI coloring
# Color constants
export ANSI="\033["
export TXTYLW='0;33m' # Yellow
export TXTRST='0m'    # Text Reset, disable coloring
echo_yellow() {
  echo -e "${ANSI}${TXTYLW}${1}${ANSI}${TXTRST}"
}

# Arch's pacman has a terrible UI/UX, so...
# Note: May need to run as sudo for some ops. See note below.
# Note: The Arch docs strongly recommend against updating the package db (a "sync") without also upgrading the relevant local packages.
# They also recommend against installing a new package without first updating the package db (sync).
# Of course, pacman lets you EASILY violate these strong warnings with no warning whatsoever! Bad noob!
# For this reason, any `pac install`` first updates the package db and also updates anything outdated, and THEN installs the named package;
# and the "upgrade" option here is basically a placebo/no-op that just updates the db and all packages, regardless of args.
# This is surely confusing for newcomers (it has to do with the whole "rolling release" thing), so I provided placebo options. ;)
# NOTE ON SUDO: For the commands that require sudo, you have to put this file somewhere in your PATH, name it "pac", make sure it's
# executable, and then sudo will work as in `sudo pac install whatever` because otherwise, sudo can't run functions (ARRGGHH)

_pac_help() {
  cat << EOF
Are you an archlinux noob?
Are you tired of running "man pacman" every other time you need to use it for something that should be simple?
I have a possible solution! PAC! A sane wrapper for pacman (and yay, if you turn on AUR support)

Configuration:
      Set PAC_USE_AUR env variable to include the AUR- This currently depends on and requires the installation of "yay".
      Set PAC_MUTE_CMD_ECHO env variable to stop pac from printing out the underlying command it will run before it runs it.

Usage: 
      pac install | i | upgrade | update | up | system_upgrade | su [--force-refresh] [<packagename>]
      -- These are all essentially synonyms.
         Updates the local package db, upgrades local packages, then optionally installs a package.
         For the reasons why you shouldn't update the local package db without also upgrading all packages,
         and why you shouldn't install anything new without first doing the above, see the arch docs.
         --force-refresh forces a sync update across all repos and forces reinstalls on any installation
         (normally, anything already installed is skipped).

      pac uninstall | u | remove | r [--orphaned | --gone] [<packagename>]
      -- Uninstalls a package and removes any dependencies that aren't needed by something else (but non-aggressively).
         --orphaned uninstalls any deps not needed by anything which might have been missed.
         --gone uninstalls any deps which aren't listed in any known repos (note: may include manually-installed packages!)

      pac orphaned | o
      -- List any orphaned deps.

      pac list | l
      -- List locally-installed packages.

      pac inspect | info <packagename>
      -- Prints out detailed information about a package.

      pac files <packagename>
      -- What files WOULD this package install?

      pac owns <path/to/file>
      -- What package owns this file? (Can also name any executable in PATH.)

      pac search | s | query | q | find | f [--local | --remote] <expression>
      -- Searches package names and descriptions with an expression which can be a regex.
         --local searches the local package db, --remote searches the remote db.
         Default is --remote.

      pac clean | c | purge
      -- Cleans out all cached or partially-downloaded data.

      pac outdated | stale
      -- Returns a list of local packages which have a newer remote version.
         NOTE: Unlike the naïve solution, this does NOT update the main local package db first!
         (Which was very important to keep things in sync. Rolling distro, and all that.)

      pac deptree <packagename>
      -- Print out a dependency tree for both the packages this package depends on,
         and the other packages dependent on it.

      pac needed_by | deps [--flat | --unique] <packagename>
      -- Packages that the named package depends on (as a tree).
         The two options return a uniquified flat list instead of a tree
         (suitable for outputting to other commands).

      pac needs | depends_on [--flat | --unique] <packagename>
      -- Packages that are dependent on the named package (as a tree).
         The two options return a uniquified flat list instead of a tree
         (suitable for outputting to other commands).

      pac valid[ate] <packagename>
      -- Thoroughly checks that all the files belonging to the package are valid.

      pac unlock
      -- Unlocks the package lock, in the event it was inadvertently left locked. May require sudo.
         Make sure there isn't another package update running in another terminal!

      pac doc[tor]
      -- Checks various things in the package system to identify discrepancies.
      Probably incomplete, happy to take PR's to improve this.
EOF
}

pac() {
  if [ "${PAC_USE_AUR}" ]; then # if it's set...
    local PACMAN_COMMAND=${PACMAN_COMMAND:-yay}
  else
    local PACMAN_COMMAND=${PACMAN_COMMAND:-pacman}
  fi
  case $PACMAN_COMMAND in
    yay)
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "Including the AUR..."
      needs yay "run: pacman -S --needed git base-devel yay"
      ;;
    pacman)
      needs pacman it comes as part of archlinux
      ;;
  esac
  case $1 in
    install | i | upgrade | update | up | system_upgrade | su)
      case $2 in
        "--force-refresh" | "-f")
          shift; shift;
          [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Syyuu $*"
          $PACMAN_COMMAND -Syyuu $*
          ;;
        *)
          shift;
          [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Syuu --needed $*"
          $PACMAN_COMMAND -Syuu --needed $*
          ;;
      esac
      ;;
    uninstall | remove | u | r)
      case $2 in
        "--orphaned" | "--orphans" | "-o")
          if [ $($PACMAN_COMMAND -Qdtq) ]; then
            [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Qdtq | $PACMAN_COMMAND -Rns -"
            $PACMAN_COMMAND -Qdtq | $PACMAN_COMMAND -Rns -
          else
            echo "No orphaned packages found."
          fi
          ;;
        "--gone") # packages that are in no known repositories
          if [ $($PACMAN_COMMAND -Qmq) ]; then
            [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Qmq | $PACMAN_COMMAND -Rns -"
            $PACMAN_COMMAND -Qmq | $PACMAN_COMMAND -Rns -
          else
            echo "No installed packages found that are currently nonexistent in known repositories."
          fi
          ;;
        *)
          shift;
          [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Russ $*"
          $PACMAN_COMMAND -Russ $*
          ;;
      esac
      ;;
    orphaned | orphans | o)
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Qdt"
      $PACMAN_COMMAND -Qdt || echo "No orphaned packages found."
      ;;
    gone)
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Qmq"
      $PACMAN_COMMAND -Qmq || echo "No installed packages found that are currently nonexistent in known repositories."
      ;;
    list | l) # local explicitly installed packages
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Qe"
      $PACMAN_COMMAND -Qe
      ;;
    inspect | info)
      shift;
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Qii $*"
      $PACMAN_COMMAND -Qii $*
      ;;
    files) # what files will this package install?
      shift;
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Ql $*"
      $PACMAN_COMMAND -Ql $*
      ;;
    owns) # what package owns this file (given a path)?
      shift;
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Qo $*"
      $PACMAN_COMMAND -Qo $*
      ;;
    search | s | query | q | find | f) # can be a regexp! Multiple clauses are AND'ed.
      case $2 in
        "--local" | "-l")
          shift; shift;
          [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Qs $*"
          $PACMAN_COMMAND -Qs $*
          ;;
        "--remote" | "-r")
          shift; shift;
          [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Ss $*"
          $PACMAN_COMMAND -Ss $*
          ;;
        *) # default to remote
          shift;
          [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Ss $*"
          $PACMAN_COMMAND -Ss $*
          ;;
      esac
      ;;
    clean | c | purge)
      needs paccache provided by pacman-contrib
      echo "Cleaning all cached package data for uninstalled packages."
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "paccache -ruk0"
      paccache -ruk0
      echo "Cleaning all cached package data for installed packages except for the most recent old version."
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "paccache -rk1"
      paccache -rk1
      echo "Removing any partially-downloaded packages."
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "find /var/cache/pacman/pkg/ -iname \"*.part\" -delete"
      find /var/cache/pacman/pkg/ -iname "*.part" -delete
      echo "Cleaning unused sync db."
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Sc"
      $PACMAN_COMMAND -Sc
      ;;
    outdated | stale)
      # note: this is SAFE in that it does NOT update the main local package db to get this information,
      # thus avoiding the warnings mentioned above
      needs checkupdates provided by pacman-contrib
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "checkupdates"
      checkupdates || echo "Up to date."
      ;;
    deptree)
      needs pactree provided by pacman-contrib
      shift;
      echo "Packages that the named package depends on:"
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "pactree $*"
      pactree $*
      echo
      echo "Packages that depend on the named package:"
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "pactree -r $*"
      pactree -r $*
      ;;
    needed_by | deps)
      needs pactree provided by pacman-contrib
      case $2 in
        "--flat" | "--unique")
          shift; shift;
          [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "pactree -u $*"
          pactree -u $*
          ;;
        *) # default to tree
          echo "Packages that the named package depends on:"
          shift;
          [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "pactree $*"
          pactree $*
          ;;
      esac
      ;;
    needs | depends_on)
      needs pactree provided by pacman-contrib
      case $2 in
        "--flat" | "--unique")
          shift; shift;
          [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "pactree -ru $*"
          pactree -ru $*
          ;;
        *) # default to tree
          echo "Packages that depend on the named package:"
          shift;
          [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "pactree -r $*"
          pactree -r $*
          ;;
      esac
      ;;
    validate | valid)
      shift;
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Qkk $*"
      $PACMAN_COMMAND -Qkk $*
      ;;
    unlock)
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "rm /var/lib/pacman/db.lck"
      rm /var/lib/pacman/db.lck || echo "The pacman package DB is NOT locked! (or you need to sudo)"
      ;;
    doctor | doc)
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Dkk"
      $PACMAN_COMMAND -Dkk
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "$PACMAN_COMMAND -Qkk | grep -v ' 0 altered files'"
      $PACMAN_COMMAND -Qkk | grep -v ' 0 altered files'
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "[ -f /var/lib/pacman/db.lck ]"
      [ -f /var/lib/pacman/db.lck ] && echo "The pacman package DB is locked. If you're not currently running pac/pacman, run 'sudo pac unlock'."
      ;;
    *)
      _pac_help
      ;;
  esac
}

# run the function, passing along any args, if this file was run directly (such as via sudo) instead of as an include
# sometimes, $0 contains a leading dash to indicate an interactive (or is it login?) shell,
# which is apparently an old convention (which also broke the basename call on OS X)
me=$(basename ${0##\-})
if [ "$me" = "pac" ]; then
  pac $*
fi
