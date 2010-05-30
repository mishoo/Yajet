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
                                $("script[type=text/x-yajet]").compile();
                        }
                }
        };

        $.yajet = {
                init: init
        };

        $.fn.yajet = function(self, args) {
                init();
                return this.each(function(){
                        var J = $(this),
                            html = COMPILER.process(J.attr("yajet-template"), self, args);
                        if (J.attr("yajet-escape-output"))
                                html = COMPILER.filter("html", html);
                        J.html(html);
                });
        };

        $.fn.compile = function() {
                init();
                var full = "", rc = COMPILER.reader_char();
                this.each(function(){
                        var J = $(this),
                            code = J.text(),
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
