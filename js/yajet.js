//> Copyright (c) 2010, Mihai Bazon <mihai.bazon@gmail.com>.  All rights
//> reserved.
//>
//> Redistribution and use in source and binary forms, with or without
//> modification, are permitted provided that the following conditions are met:
//>
//>     * Redistributions of source code must retain the above copyright notice,
//>       this list of conditions and the following disclaimer.
//>
//>     * Redistributions in binary form must reproduce the above copyright
//>       notice, this list of conditions and the following disclaimer in the
//>       documentation and/or other materials provided with the distribution.
//>
//> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY EXPRESS OR
//> IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
//> MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
//> EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY DIRECT, INDIRECT,
//> INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
//> LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
//> OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
//> LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
//> NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
//> EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

function YAJET(yajet_args){

        yajet_args = DEF(yajet_args || {}, {
                reader_char : "$",
                filters     : {},
                with_scope  : false
        });

        // special constructs:
        //
        // $foo, ${foo} -- output of variable foo
        // $foo|html, ${foo|html} -- output foo, escaping HTML characters
        // $(when (condition) ... $)
        // $(if (condition) ... $(else) ... $)
        // $(map (var => list) ... $)
        // $(maphash (key, val => obj) ... $)
        // $(let ((var1 => value1) (var2 => value2)) ... $)
        // $(continue)
        // $(break)
        //
        // The "=>" is just syntactic sugar for ","

        var GENSYM = 0;
        function gensym() {
                return "__GSY" + (++GENSYM);
        };

        function last(a) {
                return a[a.length - 1];
        };

        function map(a, f) {
                var i = 0, n = a.length, b = new Array(n);
                while (--n >= 0)
                        b[i] = f(a[i++]);
                return b;
        };

        var PARENS = {
                "(" : ")",
                "{" : "}",
                "[" : "]"
        };

        var READER_CHAR = yajet_args.reader_char;
        var READER_CHAR_STR = to_js_string(READER_CHAR);

        var BUFFER_DEF = ( "var __BUF = '';" +
                           "function __OUT(str) { if (str != null) __BUF += str };" +
                           "function __VUT(str) { if (str != null) __BUF += str };" );

        function compile(THE_STRING) {
                var THE_PREAMBLE = [],
                    THE_CODE = [],
                    THE_CLOSING = [],
                    THE_INDEX = 0,
                    THE_LENGTH = THE_STRING.length,
                    THE_TEXT = "";

                parse();
                if (yajet_args.with_scope) {
                        THE_CODE.unshift("with (this) {");
                        THE_CODE.push("}");
                }
                return makeClosure.call(this, THE_PREAMBLE.join("\n") + THE_CODE.join("\n"));

                function rest(len) {
                        return THE_STRING.substr(THE_INDEX, len != null ? len : THE_LENGTH);
                };

                function out(code) {
                        THE_CODE.push(code);
                };

                function flush_text() {
                        if (THE_TEXT.length > 0) {
                                out("__OUT(" + to_js_string(THE_TEXT) + ");");
                        }
                        THE_TEXT = "";
                };

                function skip_ws() {
                        while (THE_INDEX < THE_LENGTH && /\s/.test(THE_STRING.charAt(THE_INDEX)))
                                THE_INDEX++;
                };

                function assert(ch) {
                        var ret = looking_at(ch);
                        if (!ret) {
                                EX_PARSE("Expecting " + ch + " at " + THE_INDEX);
                        }
                        return ret;
                };

                function assert_skip(ch) {
                        THE_INDEX += assert(ch).length;
                };

                function skip(ch) {
                        var ret = looking_at(ch);
                        if (ret)
                                THE_INDEX += ret.length;
                        return ret;
                };

                function looking_at(ch) {
                        if (ch instanceof RegExp) {
                                var m = ch.exec(rest());
                                if (m) return {
                                        match: m[0],
                                        length: m[0].length,
                                        groups: m
                                };
                        }
                        else return rest(ch.length) == ch ? {
                                match: ch,
                                length: ch.length
                        } : null;
                };

                function block_open(code, end) {
                        if (!end)
                                end = "}";
                        out(code);
                        THE_CLOSING.push(end);
                };

                function block_close() {
                        var end = THE_CLOSING.pop();
                        if (end instanceof Function) {
                                end();
                        } else {
                                out(end);
                        }
                };

                function read_balanced(wantList) {
                        skip_ws();
                        var begc = THE_STRING.charAt(THE_INDEX);
                        var endc = PARENS[begc];
                        if (endc) {
                                var open = [ endc ];
                                var expr = "";
                                var ret = [];
                                ++THE_INDEX;
                                while (THE_INDEX < THE_LENGTH) {
                                        var ch = THE_STRING.charAt(THE_INDEX);
                                        if (ch == last(open)) {
                                                open.pop();
                                                ++THE_INDEX;
                                                if (open.length == 0) {
                                                        if (wantList) {
                                                                expr = expr.trim();
                                                                if (expr)
                                                                        ret.push(expr);
                                                                return ret;
                                                        }
                                                        return expr;
                                                }
                                                expr += ch;
                                        }
                                        else if (ch in PARENS) {
                                                open.push(PARENS[ch]);
                                                ++THE_INDEX;
                                                expr += ch;
                                        }
                                        else if (ch == '"' || ch == "'") {
                                                expr += to_js_string(read_string());
                                        }
                                        else if (wantList && open.length == 1 &&
                                                 ( skip(",") || skip(";") || skip("=>") || skip("..") || skip(/^\sin\b/i)) ) {
                                                ret.push(expr);
                                                expr = "";
                                        }
                                        else {
                                                // skip comments
                                                if (looking_at("//")) {
                                                        var pos = THE_STRING.indexOf("\n", THE_INDEX + 2);
                                                        if (pos == -1)
                                                                // new newline at EOF
                                                                pos += THE_LENGTH;
                                                        THE_INDEX = pos + 1;
                                                }
                                                else if (looking_at("/*")) {
                                                        var pos = THE_STRING.indexOf("*/", THE_INDEX + 2);
                                                        if (pos == -1)
                                                                EX_PARSE("Unfinished comment at " + rest());
                                                        THE_INDEX = pos + 2;
                                                }
                                                else if (looking_at("<!--")) {
                                                        var pos = THE_STRING.indexOf("-->", THE_INDEX + 4);
                                                        if (pos == -1)
                                                                EX_PARSE("Unfinished comment at " + rest());
                                                        THE_INDEX = pos + 3;
                                                }
                                                else {
                                                        ++THE_INDEX;
                                                        expr += ch;
                                                }
                                        }
                                }
                        }
                };

                function parse() {
                        while (THE_INDEX < THE_LENGTH) {
                                var ch = THE_STRING.charAt(THE_INDEX++);
                                if (ch == READER_CHAR) {
                                        flush_text();
                                        read_code();
                                }
                                else {
                                        THE_TEXT += ch;
                                }
                        }
                        flush_text();
                };

                function read_string() {
                        var begc = THE_STRING.charAt(THE_INDEX);
                        if (begc == "'" || begc == '"') {
                                var esc = false, data = "";
                                while (++THE_INDEX < THE_LENGTH) {
                                        var ch = THE_STRING.charAt(THE_INDEX);
                                        if (!esc) {
                                                if (ch == "\\") {
                                                        esc = true;
                                                        continue;
                                                }
                                                if (ch == begc) {
                                                        ++THE_INDEX;
                                                        return data;
                                                }
                                        }
                                        esc = false;
                                        data += ch;
                                }
                                EX_PARSE("Unterminated string");
                        }
                };

                function read_simple_token() {
                        var token = "";
                        while (THE_INDEX < THE_LENGTH && /[a-z0-9_$.\|]/i.test(THE_STRING.charAt(THE_INDEX))) {
                                token += THE_STRING.charAt(THE_INDEX);
                                ++THE_INDEX;
                        }
                        return token;
                };

                function read_valist() {
                        skip_ws();
                        var bindings = [];
                        assert_skip("(");
                        while (THE_INDEX < THE_LENGTH) {
                                skip_ws();
                                if (looking_at("(")) {
                                        bindings.push(read_balanced(true));
                                }
                                else if (skip(")")) {
                                        break;
                                }
                                else {
                                        bindings.push(read_simple_token());
                                }
                        }
                        out("var " + map(bindings, function(b){
                                return b instanceof Array ? b[0] + " = " + b[1] : b;
                        }).join(", ") + ";");
                };

                function read_code() {
                        if (skip(READER_CHAR)) {
                                out("__OUT(" + READER_CHAR_STR + ")");
                        }
                        else if (skip("_")) {
                                out("__VUT($_);"); // perlism
                        }
                        else if (skip("-")) {
                                skip_ws();
                        }
                        else if (skip(/^\((if|when)\b/i)) {
                                block_open("if (" + read_balanced() + ") {");
                        }
                        else if (skip(/^\(unless\b/i)) {
                                block_open("if (!(" + read_balanced() + ")) {");
                        }
                        else if (skip(/^\(else\)/i)) {
                                out("} else {"); // shortcut, no need for block_close / block_open here
                        }
                        else if (skip(/^\(elsif\b/i)) {
                                skip_ws();
                                out("} else if (" + read_balanced() + ") {"); // again
                                if (THE_STRING.charAt(THE_INDEX) == ")")
                                        ++THE_INDEX;
                        }
                        else if (skip(/^\(maphash\b/i)) {
                                var args = read_balanced(true);
                                var key = args[0], val = args[1], hash = args[2], sym = gensym();
                                out("var " + sym + " = " + hash + ";");
                                block_open("for (var " + key + " in " + sym + ") {");
                                out("if (!" + sym + ".hasOwnProperty(" + key + ")) continue;");
                                out("var " + val + " = " + sym + "[" + key + "];");
                        }
                        else if (skip(/^\((map|foreach)\b/i)) {
                                var args = read_balanced(true), idx, key, arr, sym = gensym();
                                if (args.length == 3) {
                                        idx = args[0], key = args[1], arr = args[2];
                                } else {
                                        idx = gensym();
                                        if (args.length == 2) {
                                                key = args[0], arr = args[1];
                                        }
                                        else if (args.length == 1) {
                                                arr = args[0];
                                        }
                                }
                                out("var " + sym + " = " + arr + ";");
                                var loop = "for (var " + idx + " = 0; " + idx + " < " + sym + ".length; ++" + idx + ") {";
                                if (args.length == 1) {
                                        // when no name has been specified for the value variable,
                                        // iterate inside a "with" block for each element.
                                        // additionally, provide the $_ perlism to refer to the current element itself.
                                        block_open(
                                                // open
                                                ( loop +
                                                  "with ({ $_ :" + sym + "[" + idx + "]}) {" +
                                                  "with ($_) {" )
                                                ,
                                                // close loop and the with blocks
                                                "}}}"
                                        );
                                } else {
                                        block_open(loop);
                                        out("var " + key + " = " + sym + "[" + idx + "];");
                                }
                        }
                        else if (skip(/^\((repeat|loop)\b/i)) {
                                skip_ws();
                                var args = read_balanced(true), count, start = 1, idx, sym = gensym();
                                if (args.length == 3)
                                        start = args.shift();
                                count = args.shift();
                                idx = args.shift() || gensym();
                                block_open(
                                        // open
                                        ( "var " + sym + " = " + count + "; " +
                                          "for (var " + idx + " = " + start + "; " + idx + " <= " + sym + "; ++" + idx + ") {" )
                                );
                        }
                        else if (skip(/^\(continue\)/i)) {
                                out("continue;");
                        }
                        else if (skip(/^\(break\)/i)) {
                                out("break;");
                        }
                        else if (skip(/^\(let\b/i)) {
                                block_open("(function(){", "}).call(this);");
                                read_valist();
                        }
                        else if (skip(/^\(var\b/i)) {
                                read_valist();
                                skip_ws();
                                assert_skip(")");
                        }
                        else if (skip(/^\(with\b/i)) {
                                skip_ws();
                                block_open("with (" + read_balanced() + ") {");
                        }
                        else if (skip(/^\(block\b/i)) {
                                var close = "return; }";
                                if (skip("*")) {
                                        var place = THE_CODE;
                                        THE_CODE = THE_PREAMBLE;
                                        close = function() {
                                                out("return; }");
                                                THE_CODE = place;
                                        };
                                }
                                skip_ws();
                                var name = read_simple_token().trim();
                                var args = read_balanced();
                                // THE_PREAMBLE.push("function " + name + "(){};");
                                block_open(
                                        "function " + name + "(" + args + ") {",
                                        close
                                );
                        }
                        else if (skip(/^\(function\b/i)) {
                                var close = "return __BUF; }";
                                if (skip("*")) {
                                        var place = THE_CODE;
                                        THE_CODE = THE_PREAMBLE;
                                        close = function() {
                                                out("return __BUF; }");
                                                THE_CODE = place;
                                        };
                                }
                                skip_ws();
                                var name = read_simple_token().trim();
                                var args = read_balanced();
                                // THE_PREAMBLE.push("function " + name + "(){};");
                                block_open(
                                        ( "function " + name + "(" + args + ") {" + BUFFER_DEF ),
                                        close
                                );
                        }
                        else if (skip(/^\(wrap\b/i)) {
                                skip_ws();
                                var name = read_simple_token().trim();
                                var args = read_balanced(true);
                                if (args.length > 0)
                                        args = args.join(", ") + ", ";
                                else
                                        args = "";
                                block_open(name + "(" + args + "function(__OUT, __VUT){", "})");
                        }
                        else if (skip(/^\(content\)/i)) {
                                out("arguments[arguments.length - 1].call(this, __OUT, __VUT);");
                        }
                        else if (looking_at(/^\(\s/i)) {
                                out(read_balanced() + ";");
                        }
                        else if (skip(/^\)/i)) {
                                block_close();
                        }
                        else if (skip(/^\(/i)) {
                                EX_PARSE("Unrecognized construct at " + rest());
                        }
                        else if (looking_at(/^\{/i)) {
                                var v = read_balanced(true);
                                var val = v.shift();
                                if (/\S/.test(val)) {
                                        while (v.length > 0) {
                                                var filter = v.shift().trim();
                                                // check if it has arguments
                                                var par = filter.indexOf("(");
                                                var args;
                                                if (par >= 0) {
                                                        args = filter.substring(par + 1, filter.length - 1);
                                                        filter = filter.substring(0, par);
                                                }
                                                if (!args) {
                                                        args = val;
                                                } else {
                                                        args = val + ", " + args;
                                                }
                                                val = "__YAJET.filter(" + to_js_string(filter) + ", " + args + ")";
                                        }
                                        out("__VUT(" + val + ");");
                                }
                        }
                        else {
                                var v = read_simple_token().trim().split(/\s*\|\s*/);
                                var val = v.shift();
                                while (v.length > 0) {
                                        val = "__YAJET.filter(" + to_js_string(v.shift()) + ", " + val + ")";
                                }
                                out("__VUT(" + val + ");");
                        }
                };
        };

        function to_js_string(str) {
                return '"' + str.replace(/\x5c/g, "\\\\").replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/\x22/g, "\\\"") + '"';
        };

        function EX_PARSE(error) {
                throw new Error(error);
        };

        function EX_RUNTIME(error) {
                throw new Error(error);
        };

        function makeClosure(code) {
                try {
                        code = ( BUFFER_DEF + code + "return __BUF;" );
                        var self = this,
                            compiled = new Function("__YAJET", code);
                        function ret(data) { return compiled.call(data, self) };
                        ret.orig = compiled; // these serve debugging
                        ret.code = code;
                        return ret;
                } catch(ex) {
                        alert(code);
                        EX_RUNTIME("Bad code: " + code);
                }
        };

        var FILTERS = {
                html: function(v) {
                        return String(v).replace(/&/g, "&amp;")
                                .replace(/\x22/g, "&quot;")
                                .replace(/\x27/g, "&#x27;")
                                .replace(/</g, "&lt;")
                                .replace(/>/g, "&gt;")
                                .replace(/\u00A0/g, "&#xa0;");
                },
                upcase: function(v) {
                        return String(v).toUpperCase();
                },
                downcase: function(v) {
                        return String(v).toLowerCase();
                },
                trim: function(v) {
                        return v.replace(/^\s+|\s+$/g, "");
                }
        };

        for (var i in yajet_args.filters)
                if (yajet_args.filters.hasOwnProperty(i))
                        FILTERS[i] = yajet_args.filters[i];

        // API

        this.compile = compile;
        this.filter = function(f) {
                var args = Array$(arguments, 1);
                var filter = FILTERS[f];
                if (filter)
                        return filter.apply(this, args);
                EX_RUNTIME("No filter " + f);
        };

        /* -----[ utils ]----- */

        function DEF(a, d, i, r) {
                r = {};
                for (i in d) if (d.hasOwnProperty(i)) r[i] = d[i];
                for (i in a) if (a.hasOwnProperty(i)) r[i] = a[i];
                return r;
        };

        function Array$(obj, start) {
                if (start == null)
                        start = 0;
                var a, i, j;
                try {
                        a = Array.prototype.slice.call(obj, start);
                } catch (ex) {
                        a = new Array(obj.length - start);
                        for (i = start, j = 0; i < obj.length; ++i, ++j)
                                a[j] = obj[i];
                }
                return a;
        };

};
