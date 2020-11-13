# hogelang

インタプリタは[このページ](https://yukitomoda.github.io/hogelang/demo.html)で試すことができます。

## テーマ

- 「構文」を極力なくすこと。
- 関数型言語のように振る舞うこと。
- Brainf\*ckのようなパズル感

## 例

### 関数の実行

組み込み関数`*`を用いて、`123 * 456`を計算する。

```txt
*(123 456);
```

### 関数の作成

引数を2倍にする無名関数を作成して、引数に`123`を指定して実行する。

```txt
({n} {
    *(2 n);
})(123);
```

### 束縛

`double`を引数を2倍にする無名関数で束縛して、`double`の名前で引数を2倍にする関数を使用できるようにする。引数に`123`を指定して関数を実行する。

```txt
({dobule} {
    double(123);
})(({n} {
    *(2 n);
}));
```

## コマンド

### `(`

現在のリストをリストスタックに退避して、現在の環境で新しいリストを開始します。

### `)`

現在のリストを終了し、そのリストを親のリストに追加します。

```txt
新しいリストを開始(*1)
| さらに新しいリストを開始
| | リストに1、2、3を追加
| | | | |
( ( 1 2 3 ) )
          |
          リストを終了し、(*1)のリストに追加する
```

### `{`

現在のリストをリストスタックに退避して現在の環境で新しいリストを開始し、エスケープレベルを1増加させます。

エスケープレベルが1以上の場合、`{`と`}`を除くすべてのコマンドは実行されず、「コマンド自体をリストに追加する」動作となります。

```txt
エスケープレベルが1になる
| この範囲のコマンドは実行されず、コマンドがそのままリストに追加される。
| +-----+
{ +(1 2); }
```

主に

- 関数の仮引数の作成
  - シンボルが値に評価されないようにする
- 関数本体のコマンドリストの作成
  - コマンドが実行されないようにする

で使用します。

### `}`

エスケープレベルを1減少させます。

エスケープレベルが0となった場合、現在のリストを終了し、そのリストを親のリストに追加します。

### `;`

現在のリストから値を二つポップして、関数を実行します。

ポップされる値は一つ目（リストの末尾だったもの）が実引数のリスト、二つ目（リストの末尾から二番目だったもの）が[関数型リスト](#関数)として扱われます。

例えば関数`+`に二つの引数`1`、`2`を与えて実行する場合は、 `+(1 2);`とします。

### `[0-9]+`

数値を現在のリストに追加します。

### その他

すべてシンボルとして扱われます。

シンボルコマンドが実行された場合、現在の環境でそのシンボルに束縛されている値をプッシュします。なお、この値の探索は親の環境へ再帰的に行われます。

```txt
({hoge} {
    ({fuga} {
        +(hoge fuga);
    })(2);
})(1);
```

## リスト

リストは、hogelangにおいて最も重要なデータ構造です。このリストは単純に複数の値を持つだけでなく、自身が作成された環境を保持しています。

ふつう、リストを作成するには`(`、`)`コマンドを使用します。

```txt
# 1, 2, 3 の三つを要素に持つリストを作成し、現在のリストにプッシュする。 #
(1 2 3)
```

もちろん、リストは入れ子にすることができます。

```txt
#
- 1, 2, 3 の三つを要素に持つリスト
- 4, 5 の二つを要素に持つリスト
の二つを要素に持つリストを作成する。
#
((1 2 3) (4 5))
```

`{`、`}`コマンドは`(`、`)`の特殊なバージョンで、コマンドの実行やシンボルの値の解決をせず、コマンドやシンボルをそのままリストに含めます。

```txt
#
- シンボル +
- リストを開始するコマンド (
- 値1をプッシュするコマンド 1
- 値2をプッシュするコマンド 2
- リストを終了するコマンド )
- 関数を実行するコマンド ;
の6つを要素に持つリストを作成する。
#
{ +(1 2); }
```

## 環境

環境は、hogelangにおいてリストと並び中核となるデータ構造です。環境が保持するデータは以下の通りです。

- 現在実行中のコード
- 現在の実行位置
- 名前空間
- 親の環境
- 現在操作中のリスト
- リストスタック

環境は、関数の実行毎にその関数のコードの環境を親として一つ作成され、その関数の引数が名前空間に登録されます。またこの環境下で作成された全てのリストは、この環境を親に持って作成されます。したがって、環境の名前空間はレキシカルスコープに近いふるまいをします。

## 関数

関数は、

- 仮引数リスト
- コマンドのリスト

の二つの要素をもつリストです。

例えば値をインクリメントする関数は、

```txt
(
    { n }
    { +(n 1); }
)
```

のように表現します。この関数型リストは、`{ n }`という仮引数リストと、`{ +(n 1); }`というコマンドリストから構成されています。
