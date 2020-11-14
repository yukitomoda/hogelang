const HogeLang = (function () {
  function List(arr, env) {
    this.env = env;
    this.arr = arr;
  }

  List.prototype.get = function (index) {
    if (index < 0 || this.arr.length <= index) throw new Error(`Invalid index: ${index} (length: ${this.arr.length})`);
    return this.arr[index];
  };

  List.prototype.push = function (value) {
    this.arr.push(value);
  };

  List.prototype.pop = function () {
    return this.arr.pop();
  };

  List.prototype.getLength = function () {
    return this.arr.length;
  };

  List.prototype.concat = function(other) {
    const arr = this.arr.concat(other.arr);
    return new List(arr, this.env);
  };


  function Env(namespace, code) {
    this.namespace = namespace;
    this.code = code || new List([], null);
    this.parent = this.code.env;
    this.cursor = 0;
    this.listStack = [];
    this.list = new List([], null);
  }

  Env.prototype.getValue = function (name) {
    for (let cur = this; cur; cur = cur.parent) {
      if (cur.namespace[name] != null) return cur.namespace[name];
    }
    return null;
  };

  Env.prototype.enterList = function () {
    this.listStack.push(this.list);
    this.list = new List([], this);
  };

  Env.prototype.exitList = function () {
    const parent = this.listStack.pop();
    parent.push(this.list);
    this.list = parent;
  };

  Env.prototype.pushToList = function (value) {
    this.list.push(value);
  };

  Env.prototype.popFromList = function () {
    return this.list.pop();
  };

  Env.prototype.getCurrentListLength = function () {
    return this.list.getLength();
  };

  Env.prototype.popFrontCommand = function () {
    const command = this.code.get(this.cursor);
    this.cursor++;
    return command;
  };

  Env.prototype.hasNextCommand = function () {
    return this.cursor < this.code.getLength();
  };


  function embeddedCommand(names, func) {
    return new List([
      new List(names.map(function (name) {
        return { type: 'symbol', symbol: name };
      }), nullEnv),
      new List([
        { type: 'internalCode', func: func }
      ], nullEnv)
    ], nullEnv);
  }

  function embeddedFunction(names, func) {
    return embeddedCommand(names, function (env) {
      return { type: 'rawValue', value: func(env) };
    });
  }

  function embeddedControlCommand(names, func) {
    return embeddedCommand(names, function (env) {
      return { type: 'env', env: func(env) };
    });
  }

  const nullEnv = new Env({}, null, null);

  const rootNamespace = {
    '+': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs') + env.getValue('rhs')),
    '-': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs') - env.getValue('rhs')),
    '*': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs') * env.getValue('rhs')),
    '/': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs') / env.getValue('rhs')),
    'mod': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs') % env.getValue('rhs')),
    'floor': embeddedFunction(['value'], (env) => Math.floor(env.getValue('value'))),
    '=': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs') == env.getValue('rhs')),
    '!=': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs') != env.getValue('rhs')),
    '<': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs') < env.getValue('rhs')),
    '>': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs') > env.getValue('rhs')),
    '<=': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs') <= env.getValue('rhs')),
    '>=': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs') >= env.getValue('rhs')),
    'not': embeddedFunction(['value'], (env) => !env.getValue('value')),
    'or': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs') || env.getValue('rhs')),
    'and': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs') && env.getValue('rhs')),
    'first': embeddedFunction(['list'], (env) => env.getValue('list').get(0)),
    'rest': embeddedFunction(['list'], (env) => {
      const list = env.getValue('list');
      return new List(list.arr.slice(1), list.env);
    }),
    'concat': embeddedFunction(['lhs', 'rhs'], (env) => env.getValue('lhs').concat(env.getValue('rhs'))),
    'length': embeddedFunction(['list'], (env) => env.getValue('list').getLength()),
    'is-null': embeddedFunction(['value'], (env) => env.getValue('value') == null),
    'is-list': embeddedFunction(['value'], (env) => env.getValue('value') instanceof List),
    'if': embeddedControlCommand(['cond', 'if-true', 'if-false'], (env) => {
      if (env.getValue('cond')) {
        const code = env.getValue('if-true');
        return new Env({}, code);
      } else {
        const code = env.getValue('if-false');
        return new Env({}, code);
      }
    })
  };

  const rootEnv = new Env(rootNamespace, null);

  function Interpreter(code) {
    this.envStack = [];
    this.env = new Env({}, new List(tokenize(code), rootEnv));
    this.escapeLevel = 0;
  };

  Interpreter.prototype.next = function() {
    while(!this.env.hasNextCommand()) {
      if (0 < this.envStack.length) {
        const parent = this.envStack.pop();
        if (0 < this.env.getCurrentListLength()) parent.pushToList(this.env.popFromList());
        this.env = parent;
      } else {
        return;
      }
    }

    const command = this.env.popFrontCommand();
    console.debug(this.env.cursor, 0 < this.escapeLevel ? 'escape' : 'normal', command, this.env.list);

    if (this.escapeLevel < 1) {
      switch (command.type) {
        case '(': this.env.enterList(); break;
        case ')': this.env.exitList(); break;
        case '{':
          this.env.enterList();
          this.escapeLevel++;
          break;
        case '}': this.env.exitList(); break;

        case ';': {
          const args = this.env.popFromList();
          const func = this.env.popFromList();
          const argSymbols = func.get(0);
          const code = func.get(1);
          const namespace = {};
          for (let i = 0; i < args.getLength() && i < argSymbols.getLength(); i++) {
            const name = argSymbols.get(i).symbol;
            if (name != null) namespace[name] = args.get(i);
          }

          console.debug('invoke', namespace, code.list);

          this.envStack.push(this.env);
          this.env = new Env(namespace, code);

          break;
        }
        case 'rawValue': this.env.pushToList(command.value); break;
        case 'symbol': {
          const value = this.env.getValue(command.symbol)
          this.env.pushToList(value);
          console.debug('eval symbol', command.symbol, value);
          break;
        }
        case 'internalCode': {
          const result = command.func(this.env);
          switch (result.type) {
            case 'rawValue':
              if (result.value != null) this.env.pushToList(result.value);
              break;
            case 'env':
              this.envStack.push(this.env);
              this.env = result.env;
              break;
          }
          console.debug('execute internal code', command.func, result);
          break;
        }
        default:
          this.env.pushToList(command);
          break;
      }
    } else {
      switch (command.type) {
        case '{':
          this.escapeLevel++;
          this.env.pushToList(command);
          break;
        case '}': {
          this.escapeLevel--;
          if (this.escapeLevel < 1) {
            this.env.exitList();
          } else {
            this.env.pushToList(command);
          }
          break;
        }
        default:
          this.env.pushToList(command);
          break;
      }
    }
  };

  Interpreter.prototype.isFinished = function() {
    return !this.env.hasNextCommand() && this.envStack.length <= 0;
  };

  Interpreter.prototype.getResultValue = function() {
    if (0 < this.env.getCurrentListLength()) {
      const result = this.env.list.get(this.env.list.getLength() - 1);
      return toResultValue(result);
    } else {
      return null;
    }
  };

  Interpreter.prototype.run = function() {
    while(!this.isFinished()) {
      this.next();
    }

    return this.getResultValue();
  };

  function toResultValue(obj) {
    if (obj instanceof List) {
      return obj.arr.map((element) => toResultValue(element));
    } else {
      return obj;
    }
  }

  function tokenize(code) {
    const result = [];
    for (let i = 0; i < code.length; i++) {
      if (code[i] == '(') {
        result.push({ type: code[i] });
      } else if (code[i] == ')') {
        result.push({ type: code[i] });
      } else if (code[i] == '{') {
        result.push({ type: code[i] });
      } else if (code[i] == '}') {
        result.push({ type: code[i] });
      } else if (code[i] == ';') {
        result.push({ type: code[i] });
      } else if (code[i] == '#') {
        let end = i + 1;
        while(end < code.length && code[end] != '#') {
          end++;
        }
        i = end;
      } else if (/[\s]/.test(code[i])) {
        // 無視
      } else if (/[0-9]/.test(code[i])) {
        const begin = i;
        let end = i + 1;
        while (end < code.length && /[0-9]/.test(code[end])) {
          end++;
        }
        i = end - 1;
        result.push({
          type: 'rawValue',
          value: parseInt(code.slice(begin, end))
        }); 
      } else {
        const begin = i;
        let end = i + 1;
        while (end < code.length && /[^#(){};\s]/.test(code[end])) {
          end++;
        }
        i = end - 1;
        result.push({
          type: 'symbol',
          symbol: code.slice(begin, end)
        });
      }
    }
    return result;
  }

  return {
    Interpreter: Interpreter,
    Env: Env,
    List: List
  };
})();