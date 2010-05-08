#! /usr/bin/rhino

load("../js/yajet.js");
print("YAJET loaded");

var ARGS = {
        foo: "foo",
        bar: "bar",
        method: function() {
                return "<" + this.foo + this.bar + ">";
        }
};

var yajet = new YAJET({
        filters: {
                embed: function(v, prefix, suffix) {
                        return prefix + v + suffix;
                }
        }
});

var TESTS = [
        "basic.txt",
        "vars.txt",
        "map.txt",
        "loop.txt",
        "cond.txt",
        "blocks.txt",
        "exports.txt",
        "imports.txt"
];

for (var i = 0; i < TESTS.length; ++i) {
        run_test(TESTS[i]);
}

function run_test(file) {
        print("*** Trying " + file + "...");
        var tmpl = readFile(file);
        var func = compile(tmpl, file);
        //print(yajet._templates.test1.orig);
        if (func) {
                var output = execute(func, file);
                print("---[ GENERATED CODE ]---");
                print(indent(String(func.orig)));
                print("---[ TEMPLATE OUTPUT ]---\n");
                print(indent(output) + "\n");
                print("-------------------------------------------------------------\n");
        }
};

function compile(tmpl, name) {
        try {
                return time_it("Compiling " + name, function(){
                        return yajet.compile(tmpl);
                });
        }
        catch(ex) {
                print("COMPILE ERROR: " + ex);
                print("LINE: " + ex.lineNumber);
                print("CODE: " + ex.yajetCode);
                return null;
        }
};

function execute(func, name) {
        try {
                ARGS.template = name;
                return time_it("Executing " + name, function(){
                        return func(ARGS);
                });
        }
        catch(ex) {
                print("RUNTIME ERROR: " + ex);
                print("LINE: " + ex.lineNumber);
        }
};

function time_it(name, func) {
        var start = new Date().getTime();
        var ret = func();
        var diff = new Date().getTime() - start;
        print("*** TIME: " + name + "... " + (diff / 1000).toFixed(3) + "s");
        return ret;
};

function indent(str) {
        return "    " + str.replace(/\n/g, "\n    ");
};
