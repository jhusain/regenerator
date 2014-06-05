/**
 * Copyright (c) 2014, Facesmash, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * https://raw.github.com/facebook/regenerator/master/LICENSE file. An
 * additional grant of patent rights can be found in the PATENTS file in
 * the same directory.
 */

var assert = require("assert");
var types = require("recast").types;
var n = types.namedTypes;
var b = types.builders;
var isArray = types.builtInTypes.array;
var isObject = types.builtInTypes.object;
var NodePath = types.NodePath;
var hoist = require("./hoist").hoist;
var Emitter = require("./emit").Emitter;

exports.transform = function(node) {
  function postOrderTraverse(path) {
    assert.ok(path instanceof NodePath);
    var value = path.value;

    if (isArray.check(value)) {
      path.each(postOrderTraverse);
      return;
    }

    if (!isObject.check(value)) {
      return;
    }

    types.eachField(value, function(name, child) {
      var childPath = path.get(name);
      if (childPath.value !== child) {
        childPath.replace(child);
      }
      postOrderTraverse(childPath);
    });

    if (n.Node.check(value)) {
      visitForOfStatement.call(path, value, postOrderTraverse);
      visitNode.call(path, value, postOrderTraverse);
    }
  }

  if (node instanceof NodePath) {
    postOrderTraverse(node);
    return node.value;
  }

  var rootPath = new NodePath({ root: node });
  postOrderTraverse(rootPath.get("root"));
  return rootPath.value.root;
};

// Makes a unique context identifier. This is needed to handle retrieval of
// tempvars from contexts up the scope in nested generator situation.
// see issue #70
var nextCtxId = 0;
function makeContextId() {
  return b.identifier("$ctx" + nextCtxId++);
}

function postOrderTraverseAsyncGenerator(path) {

  assert.ok(path instanceof NodePath);
  var value = path.value;
  if (n.Function.check(value)) {
    return; // Don't descend into nested function scopes.
  }

  if (isArray.check(value)) {
    path.each(postOrderTraverseAsyncGenerator);
    return;
  }

  if (!isObject.check(value)) {
    return;
  }

  types.eachField(value, function(name, child) {
    var childPath = path.get(name);
    if (childPath.value !== child) {
      childPath.replace(child);
    }
    postOrderTraverseAsyncGenerator(childPath);
  });

  if (n.YieldExpression.check(value)) {

    var expressionStatement = path
    while (expressionStatement != null && expressionStatement.node.type != "ExpressionStatement") { 
      expressionStatement = expressionStatement.parentPath
    }

    /*
    expressionStatement.replace(
      b.blockStatement([
        b.expressionStatement(
          b.assignmentExpression(
            '=',
            b.identifier('$value'),
            b.callExpression(
              b.memberExpression(
                b.identifier("$decoratedGenerator"),
                b.identifier("next"),
                false),
              [value.argument]
            )
          )
        ),
        expressionStatement.value
      ])
    )
    */

    path.replace(b.identifier('$value'));
  }

}

function visitAsyncGenerator(node) {
  node.generator = false;
  node.async = false;
  var body = this.get("body");
  
  postOrderTraverseAsyncGenerator(body)

  types.traverse(body, function(node) {
    if (n.Function.check(node)) {
      return; // Don't descend into nested function scopes.
    }

    if (n.ReturnStatement.check(node)) {
      this.replace(
        b.blockStatement([
          b.ifStatement(b.identifier("$done"), b.returnStatement(null)),
          b.expressionStatement(
          b.callExpression(
            b.memberExpression(
              b.identifier("$decoratedGenerator"),
              b.identifier("return"),
              false),
            [node.argument]))
        ]));
        
    }
  });

  this.replace(
    b.returnStatement(
      b.newExpression(
        b.identifier("Observable"), 
        [
          b.functionExpression(
            null,
            [b.identifier("$generator")],
            b.blockStatement([
              b.variableDeclaration(
                "var",
                [
                  b.variableDeclarator(
                    b.identifier("$done"),
                    b.literal(false)),
                  b.variableDeclarator(
                    b.identifier("$decoratedGenerator"),
                    b.callExpression(
                      b.identifier("$decorateGenerator"),
                      [
                        b.identifier("$generator"),
                        b.functionExpression(
                          null,
                          [],
                          b.blockStatement([
                            b.expressionStatement(
                              b.assignmentExpression(
                                "=",
                                b.identifier("$done"),
                                b.literal(true)))
                          ]))
                      ])),
                  b.variableDeclarator(
                    b.identifier("run"),
                    b.functionExpression(
                      null,
                      [b.identifier("$value")],
                      b.blockStatement([
                        b.tryStatement(
                          body.value,
                          b.catchClause(
                            b.identifier("e"),
                            null,
                            b.blockStatement([
                              b.expressionStatement(
                                b.callExpression(
                                  b.memberExpression(
                                    b.identifier("$decoratedGenerator"),
                                    b.identifier("throw"),
                                    false),
                                  [
                                    b.identifier('e')
                                  ]))
                            ])))
                      ]))),
                  ]),
                b.expressionStatement(
                  b.callExpression(b.identifier("run"), [])
                ),
                b.returnStatement(b.identifier("$decoratedGenerator"))
              ]))
            ])));

}

function visitNode(node) {
  if (!n.Function.check(node) || !(node.generator || node.async)) {
    // Note that because we are not returning false here the traversal
    // will continue into the subtree rooted at this node, as desired.
    return;
  }

  if (node.generator && node.async) {
    visitAsyncGenerator.call(this, node);
  }
  return;
  node.generator = false;

  if (node.expression) {
    // Transform expression lambdas into normal functions.
    node.expression = false;
    node.body = b.blockStatement([
      b.returnStatement(node.body)
    ]);
  }

  // TODO Ensure $callee is not the name of any hoisted variable.
  var outerFnId = node.id || (node.id = b.identifier("$callee"));
  var innerFnId = b.identifier(node.id.name + "$");

  // TODO Ensure these identifiers are named uniquely.
  var contextId = makeContextId();
  var argsId = b.identifier("$args");
  var wrapGeneratorId = b.identifier("wrapGenerator");
  var shouldAliasArguments = renameArguments(this, argsId);
  var vars = hoist(this);

  if (shouldAliasArguments) {
    vars = vars || b.variableDeclaration("var", []);
    vars.declarations.push(b.variableDeclarator(
      argsId, b.identifier("arguments")
    ));
  }

  if (node.async) {
    renameAwaitToYield(this.get("body"));
  }

  var emitter = new Emitter(contextId);
  emitter.explode(this.get("body"));

  var outerBody = [];

  if (vars && vars.declarations.length > 0) {
    outerBody.push(vars);
  }

  var wrapGenArgs = [
    emitter.getContextFunction(innerFnId),
    // Async functions don't care about the outer function because they
    // don't need it to be marked and don't inherit from its .prototype.
    node.async ? b.literal(null) : outerFnId,
    b.thisExpression()
  ];

  var tryEntryList = emitter.getTryEntryList();
  if (tryEntryList) {
    wrapGenArgs.push(tryEntryList);
  }

  var wrapGenCall = b.callExpression(
    node.async ? b.memberExpression(
      wrapGeneratorId,
      b.identifier("async"),
      false
    ) : wrapGeneratorId,
    wrapGenArgs
  );

  outerBody.push(b.returnStatement(wrapGenCall));

  node.body = b.blockStatement(outerBody);

  if (node.async) {
    node.async = false;
    return;
  }

  var markMethod = b.memberExpression(
    wrapGeneratorId,
    b.identifier("mark"),
    false
  );

  if (n.FunctionDeclaration.check(node)) {
    var path = this.parent;

    while (path && !(n.BlockStatement.check(path.value) ||
                     n.Program.check(path.value))) {
      path = path.parent;
    }

    if (path) {
      // Here we turn the FunctionDeclaration into a named
      // FunctionExpression that will be assigned to a variable of the
      // same name at the top of the enclosing block. This is important
      // for a very subtle reason: named function expressions can refer to
      // themselves by name without fear that the binding may change due
      // to code executing outside the function, whereas function
      // declarations are vulnerable to the following rebinding:
      //
      //   function f() { return f }
      //   var g = f;
      //   f = "asdf";
      //   g(); // "asdf"
      //
      // One way to prevent the problem illustrated above is to transform
      // the function declaration thus:
      //
      //   var f = function f() { return f };
      //   var g = f;
      //   f = "asdf";
      //   g(); // f
      //   g()()()()(); // f
      //
      // In the code below, we transform generator function declarations
      // in the following way:
      //
      //   gen().next(); // { value: gen, done: true }
      //   function *gen() {
      //     return gen;
      //   }
      //
      // becomes something like
      //
      //   var gen = wrapGenerator.mark(function *gen() {
      //     return gen;
      //   });
      //   gen().next(); // { value: gen, done: true }
      //
      // which ensures that the generator body can always reliably refer
      // to gen by name.

      // Remove the FunctionDeclaration so that we can add it back as a
      // FunctionExpression passed to wrapGenerator.mark.
      this.replace();

      // Change the type of the function to be an expression instead of a
      // declaration. Note that all the other fields are the same.
      node.type = "FunctionExpression";

      var varDecl = b.variableDeclaration("var", [
        b.variableDeclarator(
          node.id,
          b.callExpression(markMethod, [node])
        )
      ]);

      if (node.comments) {
        // Copy any comments preceding the function declaration to the
        // variable declaration, to avoid weird formatting consequences.
        varDecl.comments = node.comments;
        node.comments = null;
      }

      var bodyPath = path.get("body");
      var bodyLen = bodyPath.value.length;

      for (var i = 0; i < bodyLen; ++i) {
        var firstStmtPath = bodyPath.get(i);
        if (!shouldNotHoistAbove(firstStmtPath)) {
          firstStmtPath.replace(varDecl, firstStmtPath.value);
          return;
        }
      }

      bodyPath.value.push(varDecl);
    }

  } else {
    n.FunctionExpression.assert(node);
    this.replace(b.callExpression(markMethod, [node]));
  }
}

function shouldNotHoistAbove(stmtPath) {
  var value = stmtPath.value;
  n.Statement.assert(value);

  // If the first statement is a "use strict" declaration, make sure to
  // insert hoisted declarations afterwards.
  if (n.ExpressionStatement.check(value) &&
      n.Literal.check(value.expression) &&
      value.expression.value === "use strict") {
    return true;
  }

  if (n.VariableDeclaration.check(value)) {
    for (var i = 0; i < value.declarations.length; ++i) {
      var decl = value.declarations[i];
      if (n.CallExpression.check(decl.init) &&
          n.MemberExpression.check(decl.init.callee) &&
          n.Identifier.check(decl.init.callee.object) &&
          n.Identifier.check(decl.init.callee.property) &&
          decl.init.callee.object.name === "wrapGenerator" &&
          decl.init.callee.property.name === "mark") {
        return true;
      }
    }
  }

  return false;
}

function renameArguments(funcPath, argsId) {
  assert.ok(funcPath instanceof types.NodePath);
  var func = funcPath.value;
  var didReplaceArguments = false;
  var hasImplicitArguments = false;

  types.traverse(funcPath, function(node) {
    if (node === func) {
      hasImplicitArguments = !this.scope.lookup("arguments");
    } else if (n.Function.check(node)) {
      return false;
    }

    if (n.Identifier.check(node) && node.name === "arguments") {
      var isMemberProperty =
        n.MemberExpression.check(this.parent.node) &&
        this.name === "property" &&
        !this.parent.node.computed;

      if (!isMemberProperty) {
        this.replace(argsId);
        didReplaceArguments = true;
        return false;
      }
    }
  });

  // If the traversal replaced any arguments identifiers, and those
  // identifiers were free variables, then we need to alias the outer
  // function's arguments object to the variable named by argsId.
  return didReplaceArguments && hasImplicitArguments;
}

/*
{
    "type": "ExpressionStatement",
    "expression": {
        "type": "CallExpression",
        "callee": {
            "type": "MemberExpression",
            "computed": false,
            "object": {
                "type": "Identifier",
                "name": "xs"
            },
            "property": {
                "type": "Identifier",
                "name": "forEach"
            }
        },
        "arguments": [
            {
                "type": "FunctionExpression",
                "id": null,
                "params": [
                    {
                        "type": "Identifier",
                        "name": "x"
                    }
                ],
                "defaults": [],
                "body": {
                    "type": "BlockStatement",
                    "body": [
                        {
                            "type": "ExpressionStatement",
                            "expression": {
                                "type": "CallExpression",
                                "callee": {
                                    "type": "MemberExpression",
                                    "computed": false,
                                    "object": {
                                        "type": "Identifier",
                                        "name": "console"
                                    },
                                    "property": {
                                        "type": "Identifier",
                                        "name": "log"
                                    }
                                },
                                "arguments": [
                                    {
                                        "type": "Identifier",
                                        "name": "x"
                                    }
                                ]
                            }
                        }
                    ]
                },
                "rest": null,
                "generator": false,
                "expression": false
            }
        ]
    }
}
*/
/*
function visitForOnStatement(node, traversePath) {
  if (!n.ForOnStatement.check(node)) {
    return;
  }

  this.replace(
    b.callExpression(
      b.memberExpression(
        node.right,
        b.identifier("forEach"),
        false),
      [
        b.functionExpression(
          null,
          node.left
        )
      ]));
}
*/

function visitForOfStatement(node, traversePath) {
  if (!n.ForOfStatement.check(node)) {
    return;
  }

  var tempIterId = this.scope.declareTemporary("t$");
  var tempIterDecl = b.variableDeclarator(
    tempIterId,
    b.callExpression(
      b.memberExpression(
        b.identifier("wrapGenerator"),
        b.identifier("values"),
        false
      ),
      [node.right]
    )
  );

  var tempInfoId = this.scope.declareTemporary("t$");
  var tempInfoDecl = b.variableDeclarator(tempInfoId, null);

  var init = node.left;
  var loopId;
  if (n.VariableDeclaration.check(init)) {
    loopId = init.declarations[0].id;
    init.declarations.push(tempIterDecl, tempInfoDecl);
  } else {
    loopId = init;
    init = b.variableDeclaration("var", [
      tempIterDecl,
      tempInfoDecl
    ]);
  }
  n.Identifier.assert(loopId);

  var loopIdAssignExprStmt = b.expressionStatement(
    b.assignmentExpression(
      "=",
      loopId,
      b.memberExpression(
        tempInfoId,
        b.identifier("value"),
        false
      )
    )
  );

  if (n.BlockStatement.check(node.body)) {
    node.body.body.unshift(loopIdAssignExprStmt);
  } else {
    node.body = b.blockStatement([
      loopIdAssignExprStmt,
      node.body
    ]);
  }

  this.replace(
    b.forStatement(
      init,
      b.unaryExpression(
        "!",
        b.memberExpression(
          b.assignmentExpression(
            "=",
            tempInfoId,
            b.callExpression(
              b.memberExpression(
                tempIterId,
                b.identifier("next"),
                false
              ),
              []
            )
          ),
          b.identifier("done"),
          false
        )
      ),
      null,
      node.body
    )
  );
}

function renameAwaitToYield(bodyPath) {
  types.traverse(bodyPath, function(node) {
    if (n.Function.check(node)) {
      return; // Don't descend into nested function scopes.
    }

    if (n.AwaitExpression.check(node)) {
      this.replace(b.yieldExpression(
        node.all ? b.callExpression(
          b.memberExpression(
            b.identifier("Promise"),
            b.identifier("all"),
            false
          ),
          [node.argument]
        ) : node.argument,
        false
      ));
    }
  });
}
