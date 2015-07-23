define(['exports', 'module', 'path-parser'], function (exports, module, _pathParser) {
    'use strict';

    var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

    var _Path = _interopRequireDefault(_pathParser);

    var RouteNode = (function () {
        function RouteNode() {
            var name = arguments[0] === undefined ? '' : arguments[0];
            var path = arguments[1] === undefined ? '' : arguments[1];
            var childRoutes = arguments[2] === undefined ? [] : arguments[2];

            _classCallCheck(this, RouteNode);

            this.name = name;
            this.path = path;
            this.parser = path ? new _Path['default'](path) : null;
            this.children = [];

            this.add(childRoutes);

            return this;
        }

        _createClass(RouteNode, [{
            key: 'add',
            value: function add(route) {
                var _this = this;

                if (route instanceof Array) {
                    route.forEach(function (r) {
                        return _this.add(r);
                    });
                    return;
                }

                if (!(route instanceof RouteNode) && !(route instanceof Object)) {
                    throw new Error('Route constructor expects routes to be an Object or an instance of Route.');
                }
                if (route instanceof Object) {
                    if (!route.name || !route.path) {
                        throw new Error('Route constructor expects routes to have an name and a path defined.');
                    }
                    route = new RouteNode(route.name, route.path, route.children);
                }
                // Check duplicated routes
                if (this.children.map(function (child) {
                    return child.name;
                }).indexOf(route.name) !== -1) {
                    throw new Error('Alias "' + route.name + '" is already defined in route node');
                }
                // Check duplicated paths
                if (this.children.map(function (child) {
                    return child.path;
                }).indexOf(route.path) !== -1) {
                    throw new Error('Path "' + route.path + '" is already defined in route node');
                }

                var names = route.name.split('.');

                if (names.length === 1) {
                    this.children.push(route);
                    // Push greedy spats to the bottom of the pile
                    this.children.sort(function (a, b) {
                        if (!a.parser.hasSpatParam && b.parser.hasSpatParam) return -1;
                        if (!b.parser.hasSpatParam && a.parser.hasSpatParam) return 1;
                        if (!a.parser.hasUrlParams && b.parser.hasUrlParams) return -1;
                        if (!b.parser.hasUrlParams && a.parser.hasUrlParams) return 1;
                        return a.path && b.path ? a.path.length < b.path.length : 0;
                    });
                } else {
                    // Locate parent node
                    var segments = this.getSegmentsByName(names.slice(0, -1).join('.'));
                    if (segments) {
                        segments[segments.length - 1].add(new RouteNode(names[names.length - 1], route.path, route.children));
                    } else {
                        throw new Error('Could not add route named \'' + route.name + '\', parent is missing.');
                    }
                }

                return this;
            }
        }, {
            key: 'addNode',
            value: function addNode(name, params) {
                this.add(new RouteNode(name, params));
                return this;
            }
        }, {
            key: 'getSegmentsByName',
            value: function getSegmentsByName(routeName) {
                var findSegmentByName = function findSegmentByName(name, routes) {
                    var filteredRoutes = routes.filter(function (r) {
                        return r.name === name;
                    });
                    return filteredRoutes.length ? filteredRoutes[0] : undefined;
                };
                var segments = [];
                var names = routeName.split('.');
                var routes = this.children;

                var matched = names.every(function (name) {
                    var segment = findSegmentByName(name, routes);
                    if (segment) {
                        routes = segment.children;
                        segments.push(segment);
                        return true;
                    }
                    return false;
                });

                return matched ? segments : null;
            }
        }, {
            key: 'getSegmentsMatchingPath',
            value: function getSegmentsMatchingPath(path) {
                var matchChildren = function matchChildren(nodes, pathSegment, segments) {
                    var _loop = function (i) {
                        var child = nodes[i];
                        // Partially match path
                        var match = child.parser.partialMatch(pathSegment);
                        if (match) {
                            segments.push(child);
                            Object.keys(match).forEach(function (param) {
                                return segments.params[param] = match[param];
                            });
                            // Remove consumed segment from path
                            var remainingPath = pathSegment.replace(child.parser.build(match), '');
                            // If fully matched
                            if (!remainingPath.length) {
                                return {
                                    v: segments
                                };
                            }
                            // If no children to match against but unmatched path left
                            if (!child.children.length) {
                                return {
                                    v: null
                                };
                            }
                            // Else: remaining path and children
                            return {
                                v: matchChildren(child.children, remainingPath, segments)
                            };
                        }
                    };

                    // for (child of node.children) {
                    for (var i in nodes) {
                        var _ret = _loop(i);

                        if (typeof _ret === 'object') return _ret.v;
                    }
                    return null;
                };

                var startingNodes = this.parser ? [this] : this.children;
                var segments = [];
                segments.params = {};

                return matchChildren(startingNodes, path, segments);
            }
        }, {
            key: 'getPathFromSegments',
            value: function getPathFromSegments(segments) {
                return segments ? segments.map(function (segment) {
                    return segment.path;
                }).join('') : null;
            }
        }, {
            key: 'getPath',
            value: function getPath(routeName) {
                return this.getPathFromSegments(this.getSegmentsByName(routeName));
            }
        }, {
            key: 'buildPathFromSegments',
            value: function buildPathFromSegments(segments) {
                var params = arguments[1] === undefined ? {} : arguments[1];

                return segments ? segments.map(function (segment) {
                    return segment.parser.build(params);
                }).join('') : null;
            }
        }, {
            key: 'buildPath',
            value: function buildPath(routeName) {
                var params = arguments[1] === undefined ? {} : arguments[1];

                return this.buildPathFromSegments(this.getSegmentsByName(routeName), params);
            }
        }, {
            key: 'getMatchPathFromSegments',
            value: function getMatchPathFromSegments(segments) {
                if (!segments) return null;

                var name = segments.map(function (segment) {
                    return segment.name;
                }).join('.');
                var params = segments.params;

                return { name: name, params: params };
            }
        }, {
            key: 'matchPath',
            value: function matchPath(path) {
                return this.getMatchPathFromSegments(this.getSegmentsMatchingPath(path));
            }
        }]);

        return RouteNode;
    })();

    module.exports = RouteNode;
});