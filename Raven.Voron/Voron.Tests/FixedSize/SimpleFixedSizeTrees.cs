﻿// -----------------------------------------------------------------------
//  <copyright file="SimpleFixedSizeTrees.cs" company="Hibernating Rhinos LTD">
//      Copyright (c) Hibernating Rhinos LTD. All rights reserved.
//  </copyright>
// -----------------------------------------------------------------------

using System;
using System.Text;
using Xunit;

namespace Voron.Tests.FixedSize
{
	public class SimpleFixedSizeTrees : StorageTest
	{
		[Fact]
		public void CanAdd()
		{
			using (var tx = Env.NewTransaction(TransactionFlags.ReadWrite))
			{
				var fst = tx.State.Root.FixedTreeFor("test");

				fst.Add(1);
				fst.Add(2);

				tx.Commit();
			}

			using (var tx = Env.NewTransaction(TransactionFlags.Read))
			{
				var fst = tx.State.Root.FixedTreeFor("test");

				Assert.True(fst.Contains(1));
				Assert.True(fst.Contains(2));
				Assert.False(fst.Contains(3));
				tx.Commit();
			}
		}

		[Fact]
		public void CanRemove()
		{
			using (var tx = Env.NewTransaction(TransactionFlags.ReadWrite))
			{
				var fst = tx.State.Root.FixedTreeFor("test");

				fst.Add(1);
				fst.Add(2);
				fst.Add(3);
				tx.Commit();
			}

			using (var tx = Env.NewTransaction(TransactionFlags.ReadWrite))
			{
				var fst = tx.State.Root.FixedTreeFor("test");

				fst.Remove(2);

				tx.Commit();
			}

			using (var tx = Env.NewTransaction(TransactionFlags.Read))
			{
				var fst = tx.State.Root.FixedTreeFor("test");

				Assert.True(fst.Contains(1));
				Assert.False(fst.Contains(2));
				Assert.True(fst.Contains(3));
				tx.Commit();
			}
		}

		[Fact]
		public void CanAdd_WithValue()
		{
			using (var tx = Env.NewTransaction(TransactionFlags.ReadWrite))
			{
				var fst = tx.State.Root.FixedTreeFor("test", 8);

				fst.Add(1, new Slice(BitConverter.GetBytes(1L)));
				fst.Add(2, new Slice(BitConverter.GetBytes(2L)));

				tx.Commit();
			}

			using (var tx = Env.NewTransaction(TransactionFlags.Read))
			{
				var fst = tx.State.Root.FixedTreeFor("test", 8);

				Assert.Equal(1L, fst.Read(1).CreateReader().ReadLittleEndianInt64());
				Assert.Equal(2L, fst.Read(2).CreateReader().ReadLittleEndianInt64());
				Assert.Null(fst.Read(3));
				tx.Commit();
			}
		}

		[Fact]
		public void CanRemove_WithValue()
		{
			using (var tx = Env.NewTransaction(TransactionFlags.ReadWrite))
			{
				var fst = tx.State.Root.FixedTreeFor("test", 8);

				fst.Add(1, new Slice(BitConverter.GetBytes(1L)));
				fst.Add(2, new Slice(BitConverter.GetBytes(2L)));
				fst.Add(3, new Slice(BitConverter.GetBytes(3L)));

				tx.Commit();
			}


			using (var tx = Env.NewTransaction(TransactionFlags.ReadWrite))
			{
				var fst = tx.State.Root.FixedTreeFor("test", 8);

				fst.Remove(2);

				tx.Commit();
			}

			using (var tx = Env.NewTransaction(TransactionFlags.Read))
			{
				var fst = tx.State.Root.FixedTreeFor("test", 8);

				Assert.Equal(1L, fst.Read(1).CreateReader().ReadLittleEndianInt64());
				Assert.Null(fst.Read(2));
				Assert.Equal(3L, fst.Read(3).CreateReader().ReadLittleEndianInt64());
				tx.Commit();
			}
		}
	}
}