﻿// -----------------------------------------------------------------------
//  <copyright file="TrieTests.cs" company="Hibernating Rhinos LTD">
//      Copyright (c) Hibernating Rhinos LTD. All rights reserved.
//  </copyright>
// -----------------------------------------------------------------------

using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNet.Routing.Constraints;
using Raven.Server.Routing;
using Xunit;

namespace BlittableTests.Routing
{
    public class TrieTests
    {
        [Fact]
        public void CanQueryTrie()
        {
            var trie = Trie<int>.Build(new[]
            {
                "admin/databases",
                "databases/*/docs",
                "databases/*/queries",
                "fs/*/files",
                "admin/debug-info",
            }.ToDictionary(x => x, x => 1));

            Assert.True(trie.TryMatch("admin/databases").Success);
        }

        [Theory]
        [InlineData("databases/northwind/docs")]
        [InlineData("databases")]
        [InlineData("databases/northwind/indexes/Raven/DocumentsByEntityName")]
        [InlineData("Databases/northwind/Docs")]
        [InlineData("Databases/רוח-צפונית/Docs")]
        public void CanQueryTrieWithParams(string url)
        {
            // /databases/northwind/indexes/Raven/DocumentsByEntityName
            var trie = Trie<int>.Build(new[]
            {
                "admin/databases",
                "databases/*/docs",
                "databases",
                "databases/*/queries",
                "databases/*/indexes/$",
                "fs/*/files",
                "admin/debug-info",
            }.ToDictionary(x => x, x => 1));

            Assert.True(trie.TryMatch(url).Success);
        }
    }
}