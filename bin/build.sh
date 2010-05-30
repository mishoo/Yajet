#! /bin/bash

FILES='js jquery doc test license.txt'

SCRIPT=`readlink -f $0`
BASEDIR=`dirname $SCRIPT`
cd $BASEDIR/../

TMPDIR=`mktemp -d`
mkdir $TMPDIR/yajet
cp -r $FILES $TMPDIR/yajet

cd $TMPDIR/yajet/js
yuicompressor yajet.js > yajet.min.js
yuicompressor jquery.yajet.js > jquery.yajet.min.js

cd $TMPDIR
tar zcf /tmp/yajet.tar.gz yajet

rm -rf $TMPDIR
