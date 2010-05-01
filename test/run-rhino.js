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
        "vars.txt"
];

for (var i = 0; i < TESTS.length; ++i) {
        run_test(TESTS[i]);
}

function run_test(file) {
        print("*** Trying " + file + "...");
        var tmpl = readFile(file);
        var func = compile(tmpl, file);
        if (func) {
                var output = execute(func, file);
                print("---[ TEMPLATE OUTPUT ]---\n");
                print(indent(yajet.filter("trim", output)) + "\n");
                print("---[ GENERATED CODE ]---");
                print(indent(String(func.orig)));
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
                return null;
        }
};

function execute(func, name) {
        try {
                return time_it("Executing " + name, function(){
                        return func(ARGS);
                });
        }
        catch(ex) {
                print("RUNTIME ERROR: " + ex);
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
