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
export TXTRED='0;31m' # Red
export TXTYLW='0;33m' # Yellow
export TXTGRN='0;32m' # Green
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
      pac
      -- With nothing after it, lists the options (a condensed version of this help).

      pac --help | -h | help
      -- This help screen.

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

_pac_opts() {
  cat << EOF
      ENV vars that affect behavior when set: PAC_USE_AUR, PAC_MUTE_CMD_ECHO
      Options:
      pac --help | -h | help
      pac install | i | upgrade | update | up | system_upgrade | su [--force-refresh] [<packagename>]
      pac uninstall | u | remove | r [--orphaned | --gone] [<packagename>]
      pac orphaned | o
      pac list | l
      pac inspect | info <packagename>
      pac files <packagename>
      pac owns <path/to/file>
      pac search | s | query | q | find | f [--local | --remote] <expression> # --remote is default
      pac clean | c | purge
      pac outdated | stale
      pac deptree <packagename>
      pac needed_by | deps [--flat | --unique] <packagename>
      pac needs | depends_on [--flat | --unique] <packagename>
      pac valid[ate] <packagename>
      pac unlock
      pac doc[tor]
EOF
}

pac() {
  if [ "${PAC_USE_AUR}" ]; then # if it's set...
    local PACMAN_COMMAND=${PACMAN_COMMAND:-yay}
    local CHECKUPDATES_COMMAND=${CHECKUPDATES_COMMAND:-checkupdates+aur}
  else
    local PACMAN_COMMAND=${PACMAN_COMMAND:-pacman}
    local CHECKUPDATES_COMMAND=${CHECKUPDATES_COMMAND:-checkupdates}
  fi
  case $PACMAN_COMMAND in
    yay)
      # [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow "Including the AUR..."
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
      # thus avoiding the warnings mentioned above.
      # Also, this currently doesn't return a particular exit code if there aren't any updates,
      # but the underlying "checkupdates" (as well as checkupdates+aur BUT NOT checkupdates-aur), does exit 2.
      # Should it?
      if [ "${PAC_USE_AUR}" ]; then
        needs checkupdates+aur from the AUR
      else
        needs checkupdates provided by pacman-contrib
      fi
      [ "$PAC_MUTE_CMD_ECHO" ] || echo_yellow $CHECKUPDATES_COMMAND
      # This causes it to also ignore ignored packages or groups (pacman and yay already ignore them when updating).
      # Basically, I convert the list of ignore names into a regex that then gets used as a grep -v (exclusion) filter.
      local ignored_pkgs=`egrep '^Ignore(Pkg|Group) *=' /etc/pacman.conf | awk '{for(i=3;i<=NF;++i)print $i}' | sort`
      local checked_updates=`$CHECKUPDATES_COMMAND | sort`
      if [ "$ignored_pkgs" ]; then
        local ignored_pkgs_to_regex=`echo -e "$ignored_pkgs" | xargs | sed -E 's/[[:space:]]+/\|/g'`
      else
        local ignored_pkgs_to_regex=""
      fi
      if [ "${ignored_pkgs_to_regex}" ]; then
        ignored_pkgs_to_regex="^($ignored_pkgs_to_regex)"
      fi
      local update_filter="${ignored_pkgs_to_regex}"
      if [ "$update_filter" ]; then
        local filtered_updates=`echo -en "$checked_updates" | egrep -v "$update_filter" -`
      else
        local filtered_updates="$checked_updates"
      fi
      # update_list=`comm -23 <($CHECKUPDATES_COMMAND | awk '{print $1}' | sort) <(egrep '^Ignore(Pkg|Group) *=' /etc/pacman.conf | awk '{for(i=3;i<=NF;++i)print $i}' | sort)`
      { [ "$filtered_updates" ] && echo "$filtered_updates"; } || echo "Up to date."
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
    --help | -h | help)
      _pac_help
      ;;
    *)
      _pac_opts
      ;;
  esac
}

# run the function, passing along any args, if this file was run directly (such as via sudo) instead of as an include
# sometimes, $0 contains a leading dash to indicate an interactive (or is it login?) shell,
# which is apparently an old convention (which also broke the basename call on OS X)
me=$( basename ${0##\-} )
if [ "$me" = "pac" ]; then
  pac $*
fi
