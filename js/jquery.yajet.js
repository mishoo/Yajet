//> YAJET -- Yet Another JavaScript Emplate Tengine
//> Author: Mihai Bazon <mihai.bazon@gmail.com>
//> Distributed under the BSD license.  Visit www.yajet.net for details.
//> (c) Mihai Bazon 2010
//>
//> This file is not the full template engine; it's just the jQuery integration.

(function($){

        var COMPILER;               // compiler instance

        function init(args) {
                if (!COMPILER) {
                        if (args instanceof YAJET) {
                                COMPILER = args;
                        } else {
                                args = $.extend({
                                        with_scope: true
                                }, args);
                                COMPILER = new YAJET(args);
                                $("script[type=text/x-yajet]").yajet_compile();
                        }
                }
        };

        $.yajet = {
                init: init
        };

        function getTemplate(el) {
                var tmpl;
                if (el.firstChild && el.firstChild.nodeType == 8 /* CDATA or comment */) {
                        tmpl = el.firstChild.nodeValue.replace(/\[CDATA\[|\]\]?$/g, "");
                } else {
                        tmpl = $(el).val() || $(el).html();
                }
                return tmpl;
        };

        $.fn.yajet = function(self, args) {
                init();
                return this.each(function(){
                        var J = $(this),
                            tmpl = J.attr("yajet-template"),
                            html;
                        if (tmpl) {
                                html = COMPILER.process(tmpl, self, args);
                        } else {
                                // inline template
                                tmpl = J.data("yajet-template");
                                if (!tmpl) {
                                        tmpl = getTemplate(this);
                                        tmpl = COMPILER.compile(tmpl);
                                        J.data("yajet-template", tmpl);
                                }
                                html = tmpl(self);
                        }
                        if (J.attr("yajet-escape-output"))
                                html = COMPILER.filter("html", html);
                        J.html(html);
                });
        };

        $.fn.yajet_compile = function() {
                init();
                var full = "", rc = COMPILER.reader_char();
                this.each(function(){
                        var J = $(this),
                            code = getTemplate(this),
                            name = J.attr("name"),
                            args;
                        if (name) {
                                if (/\*$/.test(name)) {
                                        name = name.substr(0, name.length - 1);
                                        code = rc + "(WITH(this)" + code + rc + ")";
                                }
                                args = J.attr("args") || "";
                                code = rc + "(EXPORT " + name + "(" + args + ")" + code + rc + ")";
                        }
                        full += code;
                });
                COMPILER.compile(full);
                return this;
        };

})(jQuery);
